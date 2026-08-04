import {
  EligibilityMode,
  PortfolioEligibilityMode,
  type Prisma,
} from '../../../generated/prisma/client.js';
// src/services/voting/eligibility.service.ts
// Resolves which elections a voter can see and which portfolios they may vote.
import prisma from '../../lib/prisma.js';
import { ForbiddenError } from '../../middlewares/error-handler.js';

/**
 * Election-level visibility filter for the voter portal: a voter sees
 * ALL_VOTERS elections, GROUPS elections scoped to any of their groups, and
 * ROLL elections they are explicitly on. Anything else does not exist for
 * them - scoping hides, it does not just refuse.
 */
export const electionVisibilityFilter = async (
  voterId: string,
): Promise<Prisma.ElectionWhereInput> => {
  const memberships = await prisma.voterGroupMembership.findMany({
    select: { groupId: true },
    where: { voterId },
  });
  const groupIds = memberships.map((m) => m.groupId);
  return {
    OR: [
      { eligibilityMode: EligibilityMode.ALL_VOTERS },
      ...(groupIds.length
        ? [
            {
              eligibilityGroups: { some: { groupId: { in: groupIds } } },
              eligibilityMode: EligibilityMode.GROUPS,
            },
          ]
        : []),
      {
        eligibilityMode: EligibilityMode.ROLL,
        voterElections: { some: { isEligible: true, voterId } },
      },
    ],
  };
};

/**
 * Assert a voter may participate in an election. An explicit
 * VoterElection.isEligible = false is an admin exclusion and blocks in every
 * mode; beyond that, GROUPS requires membership in a scoped group and ROLL
 * requires an eligible roll entry.
 */
export const assertVoterEligibleForElection = async (
  voterId: string,
  election: { eligibilityMode: EligibilityMode; id: string },
  voterElection: null | { isEligible: boolean },
): Promise<void> => {
  const refuse = (): never => {
    throw new ForbiddenError('You are not eligible to vote in this election', {
      code: 'NOT_ELIGIBLE',
      layer: 'voting',
    });
  };
  if (voterElection && !voterElection.isEligible) refuse();
  if (election.eligibilityMode === EligibilityMode.ROLL) {
    if (!voterElection?.isEligible) refuse();
  }
  if (election.eligibilityMode === EligibilityMode.GROUPS) {
    const member = await prisma.voterGroupMembership.findFirst({
      select: { id: true },
      where: {
        group: { electionEligibility: { some: { electionId: election.id } } },
        voterId,
      },
    });
    if (!member) refuse();
  }
};

export interface EligiblePortfolio {
  allowAbstain: boolean;
  candidates: {
    id: string;
    manifesto: null | string;
    name: string;
    nickname: null | string;
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
            nickname: true,
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
