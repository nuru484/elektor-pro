import {
  CandidateStatus,
  ChangeStatus,
  ElectionStatus,
  Prisma,
  Role,
} from '../../../generated/prisma/client.js';
import { LIVE_ELECTION_STATUSES } from '../../config/constants.js';
// src/services/dashboard/dashboard.service.ts
import prisma from '../../lib/prisma.js';
import {
  calculateTrend,
  fillDailySeries,
  utcDayStart,
} from '../../utils/dashboard-window.js';


/** Trend windows compare the last N days against the N before them. */
const TREND_WINDOW_DAYS = 30;
/** The votes-per-day chart shows the last two weeks. */
const VOTES_SERIES_DAYS = 14;
/** How many elections the turnout board shows. */
const TURNOUT_ELECTIONS_LIMIT = 5;
/** "Soon" for the needs-attention window (starts/ends within a day). */
const SOON_HOURS = 24;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Aggregate counts, trends, series and work queues for the admin dashboard.
 *
 * `now` is injectable for tests; everything is computed off it so the whole
 * payload is deterministic for a frozen clock.
 */
export const getAdminDashboard = async (now: Date = new Date()) => {
  const windowStart = new Date(now.getTime() - TREND_WINDOW_DAYS * MS_PER_DAY);
  const previousStart = new Date(
    now.getTime() - 2 * TREND_WINDOW_DAYS * MS_PER_DAY,
  );
  const seriesStart = utcDayStart(now, VOTES_SERIES_DAYS - 1);
  const soon = new Date(now.getTime() + SOON_HOURS * 60 * 60 * 1000);

  const previousWindow = { gte: previousStart, lt: windowStart };

  const [
    totalElections,
    activeElections,
    totalVoters,
    totalCandidates,
    pendingChanges,
    recentActivity,
    recentElections,
    votersInWindow,
    votersInPreviousWindow,
    ballotsInWindow,
    ballotsInPreviousWindow,
    electionsByStatusRaw,
    votesPerDayRaw,
    candidatesUnderReview,
    electionsEndingSoon,
    electionsStartingSoon,
    unpublishedEndedElections,
    turnoutElections,
  ] = await Promise.all([
    prisma.election.count(),
    prisma.election.count({ where: { status: ElectionStatus.IN_PROGRESS } }),
    prisma.voter.count(),
    prisma.candidate.count(),
    prisma.changeRequest.count({ where: { status: ChangeStatus.PENDING } }),
    prisma.auditLog.findMany({
      include: { actor: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { sequence: 'desc' },
      take: 10,
    }),
    prisma.election.findMany({
      include: { _count: { select: { candidates: true, portfolios: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.voter.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.voter.count({ where: { createdAt: previousWindow } }),
    prisma.ballot.count({ where: { castAt: { gte: windowStart } } }),
    prisma.ballot.count({ where: { castAt: previousWindow } }),
    prisma.election.groupBy({ _count: true, by: ['status'] }),
    // Ballots are append-only (no soft delete), so raw SQL is safe here;
    // grouping needs date_trunc, which Prisma's groupBy cannot express.
    prisma.$queryRaw<{ count: bigint; day: Date }[]>(Prisma.sql`
      SELECT date_trunc('day', "castAt" AT TIME ZONE 'UTC') AS day,
             count(*) AS count
        FROM "Ballot"
       WHERE "castAt" >= ${seriesStart}
       GROUP BY 1
    `),
    prisma.candidate.count({
      where: {
        election: {
          status: {
            in: [
              ElectionStatus.DRAFT,
              ElectionStatus.SCHEDULED,
              ElectionStatus.IN_PROGRESS,
            ],
          },
          vettingEnabled: true,
        },
        status: {
          in: [CandidateStatus.DRAFT, CandidateStatus.UNDER_REVIEW],
        },
      },
    }),
    prisma.election.count({
      where: { endDate: { lte: soon }, status: ElectionStatus.IN_PROGRESS },
    }),
    prisma.election.count({
      where: { startDate: { lte: soon }, status: ElectionStatus.SCHEDULED },
    }),
    prisma.election.count({
      where: { resultsPublishedAt: null, status: ElectionStatus.ENDED },
    }),
    prisma.election.findMany({
      orderBy: { startDate: 'desc' },
      select: {
        endDate: true,
        id: true,
        name: true,
        slug: true,
        startDate: true,
        status: true,
      },
      take: TURNOUT_ELECTIONS_LIMIT,
      where: {
        status: {
          in: [
            ElectionStatus.IN_PROGRESS,
            ElectionStatus.PAUSED,
            ElectionStatus.ENDED,
          ],
        },
      },
    }),
  ]);

  // Second round trip: per-election voted/eligible splits for the turnout
  // board. Needs the election ids from the first batch.
  const rollCounts =
    turnoutElections.length === 0
      ? []
      : await prisma.voterElection.groupBy({
          _count: true,
          by: ['electionId', 'hasVoted'],
          where: {
            electionId: { in: turnoutElections.map((e) => e.id) },
            isEligible: true,
          },
        });

  const turnoutByElection = turnoutElections.map((election) => {
    const rows = rollCounts.filter((r) => r.electionId === election.id);
    const voted = rows.find((r) => r.hasVoted)?._count ?? 0;
    const eligible = rows.reduce((sum, r) => sum + r._count, 0);
    return {
      ...election,
      eligible,
      percentage: eligible === 0 ? 0 : Number(((voted / eligible) * 100).toFixed(1)),
      voted,
    };
  });

  const votesPerDayMap = new Map(
    votesPerDayRaw.map((row) => [
      row.day.toISOString().slice(0, 10),
      Number(row.count),
    ]),
  );

  return {
    electionsByStatus: electionsByStatusRaw.map((row) => ({
      count: row._count,
      status: row.status,
    })),
    needsAttention: {
      candidatesUnderReview,
      electionsEndingSoon,
      electionsStartingSoon,
      pendingChanges,
      unpublishedEndedElections,
    },
    recentActivity,
    recentElections,
    stats: {
      activeElections,
      pendingChanges,
      totalCandidates,
      totalElections,
      totalVoters,
    },
    trends: {
      ballotsCast: {
        current: ballotsInWindow,
        trend: calculateTrend(ballotsInWindow, ballotsInPreviousWindow),
      },
      votersRegistered: {
        current: votersInWindow,
        trend: calculateTrend(votersInWindow, votersInPreviousWindow),
      },
      windowDays: TREND_WINDOW_DAYS,
    },
    turnoutByElection,
    votesSeries: fillDailySeries(votesPerDayMap, now, VOTES_SERIES_DAYS),
  };
};

/**
 * An agent's own console: the candidate they are currently observing, plus
 * every posting they have held before.
 *
 * An agent holds one live assignment at a time (enforced when assigning), so
 * this is deliberately not a searchable, paginated list - there is at most
 * one current row. Past postings become history the moment their election
 * ends, derived from status rather than stored, so nothing has to be written
 * when an election closes.
 */
export const getAgentDashboard = async (userId: string) => {
  const rows = await prisma.agentAssignment.findMany({
    include: {
      candidate: {
        select: {
          account: { select: { email: true, phone: true } },
          ballotNumber: true,
          id: true,
          manifesto: true,
          name: true,
          nickname: true,
          portfolio: { select: { id: true, name: true } },
          profilePicture: true,
          status: true,
        },
      },
      election: {
        select: {
          _count: { select: { candidates: true, portfolios: true, voterElections: true } },
          eligibilityGroups: {
            select: {
              group: {
                select: { category: { select: { name: true } }, id: true, name: true },
              },
            },
          },
          eligibilityMode: true,
          endDate: true,
          id: true,
          name: true,
          resultsPolicy: true,
          resultsPublishedAt: true,
          slug: true,
          startDate: true,
          status: true,
        },
      },
    },
    orderBy: { election: { startDate: 'desc' } },
    where: { userId },
  });

  const live = new Set<string>(LIVE_ELECTION_STATUSES);
  return {
    current: rows.find((row) => live.has(row.election.status)) ?? null,
    history: rows.filter((row) => !live.has(row.election.status)),
  };
};

/** A candidate's own candidacies. */
export const getCandidateDashboard = (userId: string) =>
  prisma.candidate.findMany({
    include: {
      election: { select: { id: true, name: true, slug: true, status: true } },
      portfolio: { select: { id: true, name: true } },
    },
    where: { account: { id: userId } },
  });

export const isStaff = (role: Role): boolean =>
  role === Role.SUPER_ADMIN || role === Role.ADMIN;
