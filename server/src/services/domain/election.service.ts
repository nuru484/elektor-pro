import type { TxClient } from '../../types/prisma.types.js';
import type { Applier } from '../change-request/types.js';

import {
  type ElectionStatus,
  type Prisma,
} from '../../../generated/prisma/client.js';
// src/services/domain/election.service.ts
import prisma from '../../lib/prisma.js';
import { NotFoundError } from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { uniqueSlug } from '../../utils/slug.js';

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
  remove: (tx, id) => tx.election.delete({ select: { id: true }, where: { id } }),
  update: (tx, id, payload) =>
    tx.election.update({
      data: payload as Prisma.ElectionUpdateInput,
      select: { id: true },
      where: { id },
    }),
};
