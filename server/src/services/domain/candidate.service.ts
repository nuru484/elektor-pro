import type { Prisma } from '../../../generated/prisma/client.js';
import type { Applier } from '../change-request/types.js';

// src/services/domain/candidate.service.ts
import prisma from '../../lib/prisma.js';
import { NotFoundError } from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';

const CANDIDATE_INCLUDE = {
  election: { select: { id: true, name: true, slug: true } },
  portfolio: { select: { id: true, name: true } },
} as const;

export const listCandidates = async (
  filters: { electionId?: string; portfolioId?: string; search?: string },
  pagination: PaginationParams,
) => {
  const where: Prisma.CandidateWhereInput = {
    ...(filters.electionId ? { electionId: filters.electionId } : {}),
    ...(filters.portfolioId ? { portfolioId: filters.portfolioId } : {}),
    ...(filters.search
      ? { name: { contains: filters.search, mode: 'insensitive' } }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.candidate.findMany({
      include: CANDIDATE_INCLUDE,
      orderBy: [{ portfolioId: 'asc' }, { order: 'asc' }],
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.candidate.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const getCandidate = async (id: string) => {
  const candidate = await prisma.candidate.findFirst({
    include: CANDIDATE_INCLUDE,
    where: { id },
  });
  if (!candidate) throw new NotFoundError('Candidate not found');
  return candidate;
};

interface CandidatePayload extends Record<string, unknown> {
  electionId?: string;
  portfolioId?: string;
}

export const candidateApplier: Applier = {
  create: (tx, payload) => {
    const { electionId, portfolioId, ...rest } = payload as CandidatePayload;
    return tx.candidate.create({
      data: {
        ...(rest as unknown as Prisma.CandidateCreateInput),
        election: { connect: { id: electionId } },
        portfolio: { connect: { id: portfolioId } },
      },
      select: { id: true },
    });
  },
  remove: (tx, id) => tx.candidate.delete({ select: { id: true }, where: { id } }),
  update: (tx, id, payload) => {
    const { electionId: _e, portfolioId, ...rest } = payload as CandidatePayload;
    return tx.candidate.update({
      data: {
        ...(rest as Prisma.CandidateUpdateInput),
        ...(portfolioId ? { portfolio: { connect: { id: portfolioId } } } : {}),
      },
      select: { id: true },
      where: { id },
    });
  },
};
