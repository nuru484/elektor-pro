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
 * Roles granted early results access via the election's settings JSON
 * (settings.resultsVisibleToRoles). An admin customization: "agents may watch
 * the tally live even though the public sees it only after close".
 */
export const rolesWithEarlyResultsAccess = (settings: unknown): string[] => {
  const roles = (settings as null | { resultsVisibleToRoles?: unknown })
    ?.resultsVisibleToRoles;
  return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [];
};

/**
 * Decide whether a viewer may see an election's results, combining publish
 * state, role, agent assignment, results policy, per-election role settings,
 * and capability grants.
 */
export const canViewResults = async (
  viewer: null | ResultsViewer,
  election: {
    id: string;
    resultsPolicy: ResultsPolicy;
    resultsPublishedAt: Date | null;
    settings?: unknown;
    status: ElectionStatus;
  },
): Promise<boolean> => {
  if (election.resultsPublishedAt) return true; // published → public
  if (!viewer) return false;

  if (viewer.role === Role.SUPER_ADMIN || viewer.role === Role.ADMIN) return true;

  // Per-election override: the admin allowed this role to see results early.
  if (rolesWithEarlyResultsAccess(election.settings).includes(viewer.role)) {
    return true;
  }

  if (viewer.role === Role.AGENT) {
    const assigned = await prisma.agentAssignment.findFirst({
      select: { id: true },
      where: { electionId: election.id, userId: viewer.id },
    });
    if (assigned) return true;
  }

  if (await hasCapability(viewer, Capability.VIEW_RESULTS, election.id)) return true;

  // Ordinary viewers (voters, candidates) follow the election's policy:
  // LIVE shows the running tally, ON_CLOSE opens up once the election is
  // over, MANUAL stays hidden until a certifier explicitly publishes - even
  // after the election has ended.
  if (election.resultsPolicy === ResultsPolicy.LIVE) return true;
  if (
    election.resultsPolicy === ResultsPolicy.ON_CLOSE &&
    isOver(election.status)
  ) {
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
    settings?: unknown;
    status: ElectionStatus;
  },
): Promise<void> => {
  if (!(await canViewResults(viewer, election))) {
    throw new ForbiddenError('Results are not available to you yet');
  }
};

export interface CandidateResult {
  approveVotes?: number;
  ballotNumber?: null | number;
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
            orderBy: [{ ballotNumber: { nulls: 'last', sort: 'asc' } }, { order: 'asc' }],
            select: {
              ballotNumber: true,
              id: true,
              name: true,
              nickname: true,
              profilePicture: true,
            },
            // Disqualified/withdrawn candidates leave the tally display; their
            // cast entries remain in the ballots but are not presented.
            where: { status: 'QUALIFIED' },
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
        ballotNumber: c.ballotNumber,
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
    // A tie is a real electoral outcome, not a sorting detail. Declaring
    // `ranked[0]` the winner handed the seat to whoever happened to sort
    // first, silently. When the top score is shared there is NO winner until
    // the commission resolves it, so say so explicitly and list who is level.
    const topVotes = ranked[0]?.votes ?? 0;
    const leaders = topVotes > 0 ? ranked.filter((c) => c.votes === topVotes) : [];
    return {
      abstain: abstainByPortfolio.get(p.id) ?? 0,
      candidates: candidates.map((c) => ({
        ...c,
        percentage: totalVotes > 0 ? Number(((c.votes / totalVotes) * 100).toFixed(2)) : 0,
      })),
      id: p.id,
      isTied: leaders.length > 1,
      name: p.name,
      skip: skipByPortfolio.get(p.id) ?? 0,
      /** Everyone level on the top score when it is contested; else empty. */
      tiedCandidates: leaders.length > 1 ? leaders : [],
      totalVotes,
      votingMethod: p.votingMethod,
      winner: leaders.length === 1 ? leaders[0] : null,
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

/**
 * Cached tally for the READ path.
 *
 * The results page is the most-watched thing in an election, and every viewer
 * refetches it whenever a ballot lands (the socket sends `results:invalidate`
 * to the whole room). That turns V viewers x B ballots-per-second into V*B
 * recomputations per second, against an endpoint measured at ~115 req/s peak:
 * 12ms of work spread over seven queries, which degrades under concurrency
 * rather than scaling with it. A couple of hundred people watching a busy
 * election would have collapsed it.
 *
 * A very short TTL fixes that without anyone noticing: live results stay live
 * to within a second, and a burst of a thousand viewers costs one computation
 * instead of a thousand. The ballot count is part of the key as well as the
 * clock, so a new ballot busts the entry immediately rather than waiting out
 * the TTL - the common case still feels instant.
 *
 * NOT used by certification: a snapshot must be exact and current, so
 * certifyResults calls computeResults directly.
 */
const RESULTS_TTL_MS = 1000;

const resultsCache = new Map<
  string,
  { ballots: number; expiresAt: number; value: ElectionResults }
>();

export const getCachedResults = async (
  electionId: string,
): Promise<ElectionResults> => {
  const ballots = await prisma.ballot.count({ where: { electionId } });
  const hit = resultsCache.get(electionId);
  if (hit?.ballots === ballots && hit.expiresAt > Date.now()) {
    return hit.value;
  }
  const value = await computeResults(electionId);
  resultsCache.set(electionId, {
    ballots,
    expiresAt: Date.now() + RESULTS_TTL_MS,
    value,
  });
  return value;
};

/** Test-only: drop memoised tallies between specs. */
export const _resetResultsCacheForTests = (): void => {
  resultsCache.clear();
};
