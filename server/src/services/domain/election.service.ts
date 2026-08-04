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
  window?: { endDate: Date; startDate: Date },
): void => {
  if (from === to) return; // idempotent re-assert
  if (!ELECTION_STATUS_TRANSITIONS[from].includes(to)) {
    throw new BadRequestError(
      `An election cannot move from ${from} to ${to}`,
      { code: 'INVALID_STATUS_TRANSITION', layer: 'election' },
    );
  }
  if (!window) return;

  // Statuses mirror the real calendar, they don't override it: an election
  // opens only inside its window and closes only after it. To act outside
  // the window, the admin first adjusts the start/close dates.
  const now = new Date();
  if (to === ElectionStatus.SCHEDULED && window.endDate <= now) {
    throw new BadRequestError(
      'This election\'s close date has already passed; move the dates forward before scheduling it',
      { code: 'WINDOW_ALREADY_OVER', layer: 'election' },
    );
  }
  if (to === ElectionStatus.IN_PROGRESS) {
    if (now < window.startDate) {
      throw new BadRequestError(
        'Voting cannot open before the start date; bring the start date forward to open now',
        { code: 'WINDOW_NOT_STARTED', layer: 'election' },
      );
    }
    if (now > window.endDate) {
      throw new BadRequestError(
        'This election\'s close date has already passed; extend the dates to reopen voting',
        { code: 'WINDOW_ALREADY_OVER', layer: 'election' },
      );
    }
  }
  if (to === ElectionStatus.ENDED && now < window.endDate) {
    throw new BadRequestError(
      'The voting window is still open; bring the close date forward to end voting now',
      { code: 'WINDOW_STILL_OPEN', layer: 'election' },
    );
  }
};

const ELECTION_INCLUDE = {
  _count: { select: { candidates: true, portfolios: true, voterElections: true } },
  createdBy: { select: { firstName: true, id: true, lastName: true } },
  eligibilityGroups: {
    select: {
      group: {
        select: { category: { select: { name: true } }, id: true, name: true },
      },
    },
  },
} as const;

export const listElections = async (
  filters: {
    /** Inclusive lower bound on startDate. */
    from?: Date;
    search?: string;
    status?: ElectionStatus;
    /** EXCLUSIVE upper bound on startDate (callers pass day-after). */
    to?: Date;
  },
  pagination: PaginationParams,
) => {
  const where: Prisma.ElectionWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? { name: { contains: filters.search, mode: 'insensitive' } }
      : {}),
    ...(filters.from || filters.to
      ? {
          startDate: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lt: filters.to } : {}),
          },
        }
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

/** Replace an election's eligibility groups with the given set (validated). */
const applyEligibilityGroups = async (
  tx: TxClient,
  electionId: string,
  groupIds: string[],
): Promise<void> => {
  const unique = [...new Set(groupIds)];
  if (unique.length) {
    const found = await tx.group.count({ where: { id: { in: unique } } });
    if (found !== unique.length) {
      throw new BadRequestError('One or more eligibility groups do not exist', {
        code: 'UNKNOWN_GROUP',
        layer: 'election',
      });
    }
  }
  await tx.electionEligibility.deleteMany({
    where: { electionId, groupId: { notIn: unique } },
  });
  if (unique.length) {
    await tx.electionEligibility.createMany({
      data: unique.map((groupId) => ({ electionId, groupId })),
      skipDuplicates: true,
    });
  }
};

/**
 * A GROUPS-mode election with no eligibility groups would be visible to (and
 * votable by) nobody; refuse the write. Runs after create/update inside the
 * same transaction so every permutation (mode change, group change, both) is
 * checked against the final state.
 */
const assertGroupsModeConsistent = async (
  tx: TxClient,
  electionId: string,
): Promise<void> => {
  const election = await tx.election.findUnique({
    select: { eligibilityMode: true },
    where: { id: electionId },
  });
  if (election?.eligibilityMode !== 'GROUPS') return;
  const groups = await tx.electionEligibility.count({ where: { electionId } });
  if (groups === 0) {
    throw new BadRequestError(
      'A group-scoped election needs at least one eligibility group',
      { code: 'ELIGIBILITY_GROUPS_REQUIRED', layer: 'election' },
    );
  }
};

/**
 * Clone an election's STRUCTURE into a fresh DRAFT: eligibility mode +
 * groups, policies, settings, vetting configuration and criteria, and every
 * portfolio (with its group scoping). Candidates, rolls, and ballots stay
 * behind - a new run starts clean; only the dates and name come from the
 * caller.
 */
const cloneElectionInTx = async (
  tx: TxClient,
  actorId: string,
  input: { cloneFromId: string; endDate: Date; name: string; slug?: string; startDate: Date },
): Promise<{ id: string }> => {
  const source = await tx.election.findFirst({
    include: {
      eligibilityGroups: { select: { groupId: true } },
      portfolios: { include: { eligibilityGroups: { select: { groupId: true } } } },
      vettingCriteria: true,
    },
    where: { id: input.cloneFromId },
  });
  if (!source) throw new NotFoundError('Election to clone was not found');

  const slug = await uniqueSlug(input.slug ?? input.name, (s) => slugExists(tx, s));
  const clone = await tx.election.create({
    data: {
      accreditationRequired: source.accreditationRequired,
      createdBy: { connect: { id: actorId } },
      description: source.description,
      eligibilityMode: source.eligibilityMode,
      endDate: input.endDate,
      name: input.name,
      resultsPolicy: source.resultsPolicy,
      settings: (source.settings ?? undefined) as Prisma.InputJsonValue | undefined,
      slug,
      startDate: input.startDate,
      status: ElectionStatus.DRAFT,
      vettingEnabled: source.vettingEnabled,
      vettingPassPercent: source.vettingPassPercent,
      voteCodeEnabled: source.voteCodeEnabled,
    },
    select: { id: true },
  });
  if (source.eligibilityGroups.length > 0) {
    await tx.electionEligibility.createMany({
      data: source.eligibilityGroups.map((g) => ({
        electionId: clone.id,
        groupId: g.groupId,
      })),
    });
  }
  for (const portfolio of source.portfolios) {
    const created = await tx.portfolio.create({
      data: {
        allowAbstain: portfolio.allowAbstain,
        description: portfolio.description,
        electionId: clone.id,
        eligibility: portfolio.eligibility,
        maxSelections: portfolio.maxSelections,
        name: portfolio.name,
        order: portfolio.order,
        votingMethod: portfolio.votingMethod,
      },
      select: { id: true },
    });
    if (portfolio.eligibilityGroups.length > 0) {
      await tx.portfolioEligibility.createMany({
        data: portfolio.eligibilityGroups.map((g) => ({
          groupId: g.groupId,
          portfolioId: created.id,
        })),
      });
    }
  }
  if (source.vettingCriteria.length > 0) {
    await tx.vettingCriterion.createMany({
      data: source.vettingCriteria.map((criterion) => ({
        description: criterion.description,
        electionId: clone.id,
        maxScore: criterion.maxScore,
        name: criterion.name,
        order: criterion.order,
      })),
    });
  }
  return clone;
};

export const electionApplier: Applier = {
  create: async (tx, payload, actorId) => {
    const input = payload as Record<string, unknown> & {
      cloneFromId?: string;
      groupIds?: string[];
      name: string;
      slug?: string;
    };
    if (input.cloneFromId) {
      return cloneElectionInTx(tx, actorId, {
        cloneFromId: input.cloneFromId,
        endDate: new Date(input.endDate as Date | string),
        name: input.name,
        slug: input.slug,
        startDate: new Date(input.startDate as Date | string),
      });
    }
    const slug = await uniqueSlug(input.slug ?? input.name, (s) => slugExists(tx, s));
    const { groupIds, slug: _slug, ...rest } = input;
    const election = await tx.election.create({
      data: {
        ...(rest as unknown as Prisma.ElectionCreateInput),
        createdBy: { connect: { id: actorId } },
        slug,
      },
      select: { id: true },
    });
    if (groupIds?.length) await applyEligibilityGroups(tx, election.id, groupIds);
    await assertGroupsModeConsistent(tx, election.id);
    return election;
  },
  remove: async (tx, id) => {
    await assertElectionUnlocked(tx, id);
    return tx.election.delete({ select: { id: true }, where: { id } });
  },
  update: async (tx, id, payload) => {
    const { groupIds, ...rest } = payload as Record<string, unknown> & {
      groupIds?: string[];
      status?: ElectionStatus;
    };
    // The certification lock freezes content, not lifecycle housekeeping: a
    // pure status change (e.g. ENDED -> ARCHIVED) stays possible and is still
    // governed by the state machine below.
    const keys = Object.keys(payload as Record<string, unknown>);
    const statusOnly = keys.length === 1 && keys[0] === 'status';
    if (!statusOnly) await assertElectionUnlocked(tx, id);
    if (rest.status) {
      const current = await tx.election.findUnique({
        select: { endDate: true, startDate: true, status: true },
        where: { id },
      });
      if (!current) throw new NotFoundError('Election not found');
      // When the same submit also moves the dates, the status is judged
      // against the NEW window ("adjust the dates to open now" in one step).
      const patch = rest as { endDate?: Date | string; startDate?: Date | string };
      assertStatusTransition(current.status, rest.status, {
        endDate: patch.endDate ? new Date(patch.endDate) : current.endDate,
        startDate: patch.startDate ? new Date(patch.startDate) : current.startDate,
      });
    }
    const election = await tx.election.update({
      data: rest as Prisma.ElectionUpdateInput,
      select: { id: true },
      where: { id },
    });
    if (groupIds) await applyEligibilityGroups(tx, id, groupIds);
    await assertGroupsModeConsistent(tx, id);
    return election;
  },
};
