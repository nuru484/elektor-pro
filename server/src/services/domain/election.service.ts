import type { DbClient, TxClient } from '../../types/prisma.types.js';
import type { Applier } from '../change-request/types.js';

import {
  ElectionStatus,
  type Prisma,
} from '../../../generated/prisma/client.js';
// src/services/domain/election.service.ts
import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { uniqueSlug } from '../../utils/slug.js';

/**
 * Certification locks an election: once results are certified the election,
 * its portfolios, and its candidates are immutable. Every election-scoped
 * applier calls this before writing (covers both the direct super-admin path
 * and staged change requests, which are applied at approval time).
 */
export const assertElectionUnlocked = async (
  client: DbClient,
  electionId: string,
): Promise<void> => {
  const election = await client.election.findUnique({
    select: { isLocked: true },
    where: { id: electionId },
  });
  if (election?.isLocked) {
    throw new ConflictError(
      'This election has certified results and is locked against changes',
      { code: 'ELECTION_LOCKED', layer: 'election' },
    );
  }
};

/**
 * The election lifecycle state machine. A manual status change must follow an
 * edge here; re-asserting the current status is an allowed no-op. The
 * scheduler's automatic transitions (SCHEDULED -> IN_PROGRESS/ENDED,
 * IN_PROGRESS -> ENDED) are all legal edges of the same machine.
 */
const ELECTION_STATUS_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  [ElectionStatus.ARCHIVED]: [],
  [ElectionStatus.CANCELLED]: [ElectionStatus.ARCHIVED],
  [ElectionStatus.DRAFT]: [ElectionStatus.CANCELLED, ElectionStatus.SCHEDULED],
  [ElectionStatus.ENDED]: [ElectionStatus.ARCHIVED],
  [ElectionStatus.IN_PROGRESS]: [ElectionStatus.ENDED, ElectionStatus.PAUSED],
  [ElectionStatus.PAUSED]: [
    ElectionStatus.CANCELLED,
    ElectionStatus.ENDED,
    ElectionStatus.IN_PROGRESS,
  ],
  [ElectionStatus.SCHEDULED]: [
    ElectionStatus.CANCELLED,
    ElectionStatus.DRAFT,
    ElectionStatus.IN_PROGRESS,
  ],
};

export const assertStatusTransition = (
  from: ElectionStatus,
  to: ElectionStatus,
): void => {
  if (from === to) return; // idempotent re-assert
  if (!ELECTION_STATUS_TRANSITIONS[from].includes(to)) {
    throw new BadRequestError(
      `An election cannot move from ${from} to ${to}`,
      { code: 'INVALID_STATUS_TRANSITION', layer: 'election' },
    );
  }
};

const ELECTION_INCLUDE = {
  _count: { select: { candidates: true, portfolios: true, voterElections: true } },
  createdBy: { select: { firstName: true, id: true, lastName: true } },
} as const;

export const listElections = async (
  filters: { search?: string; status?: ElectionStatus },
  pagination: PaginationParams,
) => {
  const where: Prisma.ElectionWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? { name: { contains: filters.search, mode: 'insensitive' } }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.election.findMany({
      include: ELECTION_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.election.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const getElection = async (idOrSlug: string) => {
  const election = await prisma.election.findFirst({
    include: {
      ...ELECTION_INCLUDE,
      portfolios: {
        include: {
          _count: { select: { candidates: true } },
          eligibilityGroups: { select: { group: { select: { id: true, name: true } } } },
        },
        orderBy: { order: 'asc' },
      },
    },
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
  if (!election) throw new NotFoundError('Election not found');
  return election;
};

const slugExists = async (tx: TxClient, slug: string): Promise<boolean> =>
  (await tx.election.findUnique({ select: { id: true }, where: { slug } })) !== null;

export const electionApplier: Applier = {
  create: async (tx, payload, actorId) => {
    const input = payload as Record<string, unknown> & {
      name: string;
      slug?: string;
    };
    const slug = await uniqueSlug(input.slug ?? input.name, (s) => slugExists(tx, s));
    const { slug: _slug, ...rest } = input;
    return tx.election.create({
      data: {
        ...(rest as unknown as Prisma.ElectionCreateInput),
        createdBy: { connect: { id: actorId } },
        slug,
      },
      select: { id: true },
    });
  },
  remove: async (tx, id) => {
    await assertElectionUnlocked(tx, id);
    return tx.election.delete({ select: { id: true }, where: { id } });
  },
  update: async (tx, id, payload) => {
    const input = payload as { status?: ElectionStatus };
    // The certification lock freezes content, not lifecycle housekeeping: a
    // pure status change (e.g. ENDED -> ARCHIVED) stays possible and is still
    // governed by the state machine below.
    const keys = Object.keys(payload as Record<string, unknown>);
    const statusOnly = keys.length === 1 && keys[0] === 'status';
    if (!statusOnly) await assertElectionUnlocked(tx, id);
    if (input.status) {
      const current = await tx.election.findUnique({
        select: { status: true },
        where: { id },
      });
      if (!current) throw new NotFoundError('Election not found');
      assertStatusTransition(current.status, input.status);
    }
    return tx.election.update({
      data: payload as Prisma.ElectionUpdateInput,
      select: { id: true },
      where: { id },
    });
  },
};
