import {
  BallotEntryType,
  Capability,
  ElectionStatus,
  EligibilityMode,
  ResultsPolicy,
  Role,
} from '../../../generated/prisma/client.js';
// src/services/results/results.service.ts
// Tally computation and results-visibility rules.
import prisma from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../middlewares/error-handler.js';
import { hasCapability } from '../authorization/capability.service.js';

export interface ResultsViewer {
  id: string;
  role: Role;
}

const isOver = (status: ElectionStatus): boolean =>
  status === ElectionStatus.ENDED || status === ElectionStatus.ARCHIVED;

/**
 * Decide whether a viewer may see an election's results, combining publish
 * state, role, agent assignment, results policy, and capability grants.
 */
export const canViewResults = async (
  viewer: null | ResultsViewer,
  election: {
    id: string;
    resultsPolicy: ResultsPolicy;
    resultsPublishedAt: Date | null;
    status: ElectionStatus;
  },
): Promise<boolean> => {
  if (election.resultsPublishedAt) return true; // published → public
  if (!viewer) return false;

  if (viewer.role === Role.SUPER_ADMIN || viewer.role === Role.ADMIN) return true;

  if (viewer.role === Role.AGENT) {
    const assigned = await prisma.agentAssignment.findFirst({
      select: { id: true },
      where: { electionId: election.id, userId: viewer.id },
    });
    if (assigned) return true;
  }

  if (await hasCapability(viewer, Capability.VIEW_RESULTS, election.id)) return true;

  if (isOver(election.status)) return true;
  // Voters may see live results only under a LIVE policy. Candidates wait.
  if (viewer.role === Role.VOTER && election.resultsPolicy === ResultsPolicy.LIVE) {
    return true;
  }
  return false;
};

export const assertCanViewResults = async (
  viewer: null | ResultsViewer,
  election: {
    id: string;
    resultsPolicy: ResultsPolicy;
    resultsPublishedAt: Date | null;
    status: ElectionStatus;
  },
): Promise<void> => {
  if (!(await canViewResults(viewer, election))) {
    throw new ForbiddenError('Results are not available to you yet');
  }
};

export interface CandidateResult {
  approveVotes?: number;
  id: string;
  name: string;
  nickname: null | string;
  profilePicture: null | string;
  rejectVotes?: number;
  votes: number;
}

/** Compute the full tally for an election in a small, fixed number of queries. */
export const computeResults = async (electionId: string) => {
  const election = await prisma.election.findFirst({ where: { id: electionId } });
  if (!election) throw new NotFoundError('Election not found');

  const [portfolios, grouped, totalVoted, eligibleCount, allVoterCount, groupEligibleCount] =
    await Promise.all([
      prisma.portfolio.findMany({
        include: {
          candidates: {
            orderBy: { order: 'asc' },
            select: { id: true, name: true, nickname: true, profilePicture: true },
          },
        },
        orderBy: { order: 'asc' },
        where: { electionId },
      }),
      prisma.ballotEntry.groupBy({
        _count: { _all: true },
        by: ['portfolioId', 'candidateId', 'type', 'approve'],
        where: { ballot: { electionId } },
      }),
      prisma.voterElection.count({ where: { electionId, hasVoted: true } }),
      prisma.voterElection.count({ where: { electionId, isEligible: true } }),
      prisma.voter.count(),
      // GROUPS mode: distinct voters belonging to any scoped group.
      prisma.voter.count({
        where: {
          groupMemberships: {
            some: { group: { electionEligibility: { some: { electionId } } } },
          },
        },
      }),
    ]);

  // Index grouped counts for O(1) lookups (avoids N+1).
  const voteCount = new Map<string, number>(); // `${portfolioId}:${candidateId}`
  const approveCount = new Map<string, number>();
  const rejectCount = new Map<string, number>();
  const skipByPortfolio = new Map<string, number>();
  const abstainByPortfolio = new Map<string, number>();

  for (const row of grouped) {
    const n = row._count._all;
    if (row.type === BallotEntryType.SKIP) {
      skipByPortfolio.set(row.portfolioId, (skipByPortfolio.get(row.portfolioId) ?? 0) + n);
    } else if (row.type === BallotEntryType.ABSTAIN) {
      abstainByPortfolio.set(
        row.portfolioId,
        (abstainByPortfolio.get(row.portfolioId) ?? 0) + n,
      );
    } else if (row.candidateId) {
      const key = `${row.portfolioId}:${row.candidateId}`;
      if (row.approve === false) {
        rejectCount.set(key, (rejectCount.get(key) ?? 0) + n);
      } else {
        voteCount.set(key, (voteCount.get(key) ?? 0) + n);
        if (row.approve === true) approveCount.set(key, (approveCount.get(key) ?? 0) + n);
      }
    }
  }

  const portfolioResults = portfolios.map((p) => {
    const candidates: CandidateResult[] = p.candidates.map((c) => {
      const key = `${p.id}:${c.id}`;
      const result: CandidateResult = {
        id: c.id,
        name: c.name,
        nickname: c.nickname,
        profilePicture: c.profilePicture,
        votes: voteCount.get(key) ?? 0,
      };
      if (p.votingMethod === 'YES_NO') {
        result.approveVotes = approveCount.get(key) ?? 0;
        result.rejectVotes = rejectCount.get(key) ?? 0;
      }
      return result;
    });
    const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
    const ranked = [...candidates].sort((a, b) => b.votes - a.votes);
    return {
      abstain: abstainByPortfolio.get(p.id) ?? 0,
      candidates: candidates.map((c) => ({
        ...c,
        percentage: totalVotes > 0 ? Number(((c.votes / totalVotes) * 100).toFixed(2)) : 0,
      })),
      id: p.id,
      name: p.name,
      skip: skipByPortfolio.get(p.id) ?? 0,
      totalVotes,
      votingMethod: p.votingMethod,
      winner: ranked[0] && ranked[0].votes > 0 ? ranked[0] : null,
    };
  });

  const totalEligible =
    election.eligibilityMode === EligibilityMode.ALL_VOTERS
      ? allVoterCount
      : election.eligibilityMode === EligibilityMode.GROUPS
        ? groupEligibleCount
        : eligibleCount;

  return {
    election: {
      certifiedAt: election.certifiedAt,
      endDate: election.endDate,
      id: election.id,
      name: election.name,
      resultsPolicy: election.resultsPolicy,
      resultsPublishedAt: election.resultsPublishedAt,
      slug: election.slug,
      startDate: election.startDate,
      status: election.status,
    },
    portfolios: portfolioResults,
    turnout: {
      percentage: totalEligible > 0 ? Number(((totalVoted / totalEligible) * 100).toFixed(2)) : 0,
      totalEligible,
      totalVoted,
    },
  };
};

export type ElectionResults = Awaited<ReturnType<typeof computeResults>>;
