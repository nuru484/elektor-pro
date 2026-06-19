// src/services/voting/eligibility.service.ts
// Resolves which portfolios a given voter may vote in a given election.
import prisma from '../../lib/prisma.js';
import { PortfolioEligibilityMode } from '../../../generated/prisma/client.js';

export interface EligiblePortfolio {
  allowAbstain: boolean;
  candidates: {
    id: string;
    manifesto: null | string;
    name: string;
    party: null | string;
    partySymbol: null | string;
    profilePicture: null | string;
  }[];
  description: null | string;
  id: string;
  maxSelections: number;
  name: string;
  order: number;
  votingMethod: string;
}

/**
 * Return the portfolios (with candidates) a voter is eligible to vote, applying
 * each portfolio's constituency rule against the voter's group memberships.
 */
export const resolveEligiblePortfolios = async (
  voterId: string,
  electionId: string,
): Promise<EligiblePortfolio[]> => {
  const [voterGroups, portfolios] = await Promise.all([
    prisma.voterGroupMembership.findMany({
      select: { groupId: true },
      where: { voterId },
    }),
    prisma.portfolio.findMany({
      include: {
        candidates: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            manifesto: true,
            name: true,
            party: true,
            partySymbol: true,
            profilePicture: true,
          },
        },
        eligibilityGroups: { select: { groupId: true } },
      },
      orderBy: { order: 'asc' },
      where: { electionId },
    }),
  ]);

  const voterGroupIds = new Set(voterGroups.map((g) => g.groupId));

  const isEligible = (portfolio: (typeof portfolios)[number]): boolean => {
    if (portfolio.eligibility === PortfolioEligibilityMode.ALL_VOTERS) return true;
    const required = portfolio.eligibilityGroups.map((g) => g.groupId);
    if (required.length === 0) return true;
    if (portfolio.eligibility === PortfolioEligibilityMode.ANY_OF_GROUPS) {
      return required.some((id) => voterGroupIds.has(id));
    }
    return required.every((id) => voterGroupIds.has(id));
  };

  return portfolios.filter(isEligible).map((p) => ({
    allowAbstain: p.allowAbstain,
    candidates: p.candidates,
    description: p.description,
    id: p.id,
    maxSelections: p.maxSelections,
    name: p.name,
    order: p.order,
    votingMethod: p.votingMethod,
  }));
};
