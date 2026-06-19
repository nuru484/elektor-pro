import type { Prisma } from '../../../generated/prisma/client.js';
import type { Applier } from '../change-request/types.js';

// src/services/domain/portfolio.service.ts
import prisma from '../../lib/prisma.js';
import { NotFoundError } from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';

const PORTFOLIO_INCLUDE = {
  _count: { select: { candidates: true } },
  eligibilityGroups: { select: { group: { select: { id: true, name: true } } } },
} as const;

export const listPortfolios = async (
  filters: { electionId?: string },
  pagination: PaginationParams,
) => {
  const where: Prisma.PortfolioWhereInput = filters.electionId
    ? { electionId: filters.electionId }
    : {};
  const [data, total] = await Promise.all([
    prisma.portfolio.findMany({
      include: PORTFOLIO_INCLUDE,
      orderBy: { order: 'asc' },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.portfolio.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const getPortfolio = async (id: string) => {
  const portfolio = await prisma.portfolio.findFirst({
    include: {
      ...PORTFOLIO_INCLUDE,
      candidates: { orderBy: { order: 'asc' } },
    },
    where: { id },
  });
  if (!portfolio) throw new NotFoundError('Portfolio not found');
  return portfolio;
};

interface PortfolioPayload extends Record<string, unknown> {
  electionId?: string;
  groupIds?: string[];
}

export const portfolioApplier: Applier = {
  create: async (tx, payload) => {
    const { electionId, groupIds, ...rest } = payload as PortfolioPayload;
    const portfolio = await tx.portfolio.create({
      data: {
        ...(rest as unknown as Prisma.PortfolioCreateInput),
        election: { connect: { id: electionId } },
      },
      select: { id: true },
    });
    if (groupIds?.length) {
      await tx.portfolioEligibility.createMany({
        data: groupIds.map((groupId) => ({ groupId, portfolioId: portfolio.id })),
        skipDuplicates: true,
      });
    }
    return portfolio;
  },
  remove: (tx, id) => tx.portfolio.delete({ select: { id: true }, where: { id } }),
  update: async (tx, id, payload) => {
    const { electionId: _electionId, groupIds, ...rest } = payload as PortfolioPayload;
    await tx.portfolio.update({
      data: rest as Prisma.PortfolioUpdateInput,
      where: { id },
    });
    if (groupIds) {
      await tx.portfolioEligibility.deleteMany({
        where: { groupId: { notIn: groupIds }, portfolioId: id },
      });
      await tx.portfolioEligibility.createMany({
        data: groupIds.map((groupId) => ({ groupId, portfolioId: id })),
        skipDuplicates: true,
      });
    }
    return { id };
  },
};
