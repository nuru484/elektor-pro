// src/services/voting/accreditation.service.ts
// The accreditation desk: look voters up within an election, check them in
// (optionally issuing a one-time sign-in code for polling stations), undo
// mistakes, and watch turnout.
import {
  EligibilityMode,
  type Prisma,
  type Role,
} from '../../../generated/prisma/client.js';
import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { generateReceiptCode, sha256 } from '../../utils/crypto.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { appendAudit } from '../audit/audit.service.js';
import { electionVisibilityFilter } from './eligibility.service.js';

/**
 * Search voters for the accreditation desk: matches by name, voter ID, or
 * phone, and reports each voter's standing for THIS election (eligibility
 * under the election's mode, accreditation, and whether they voted). With no
 * query, the desk shows the election's eligible register (A-Z) so the page is
 * never empty; a typed query searches ALL voters so standing is visible even
 * for people outside the election's scope.
 */
export const searchVotersForAccreditation = async (
  electionId: string,
  query: string,
) => {
  const election = await prisma.election.findFirst({
    select: {
      eligibilityGroups: { select: { groupId: true } },
      eligibilityMode: true,
      id: true,
      voteCodeEnabled: true,
    },
    where: { id: electionId },
  });
  if (!election) throw new NotFoundError('Election not found');

  const searching = query.trim().length >= 2;
  const eligibleUniverse: Prisma.VoterWhereInput =
    election.eligibilityMode === EligibilityMode.ALL_VOTERS
      ? {}
      : election.eligibilityMode === EligibilityMode.GROUPS
        ? {
            groupMemberships: {
              some: {
                groupId: {
                  in: election.eligibilityGroups.map((g) => g.groupId),
                },
              },
            },
          }
        : { voterElections: { some: { electionId, isEligible: true } } };

  const voters = await prisma.voter.findMany({
    orderBy: { name: 'asc' },
    select: {
      groupMemberships: { select: { groupId: true } },
      id: true,
      name: true,
      phoneNumber: true,
      profilePicture: true,
      voterElections: {
        select: {
          accreditedAt: true,
          hasVoted: true,
          isEligible: true,
          voteCodeIssuedAt: true,
        },
        where: { electionId },
      },
      voterId: true,
    },
    take: searching ? 8 : 12,
    where: searching
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { voterId: { contains: query, mode: 'insensitive' } },
            { phoneNumber: { contains: query, mode: 'insensitive' } },
          ],
        }
      : eligibleUniverse,
  });

  const scopedGroupIds = new Set(election.eligibilityGroups.map((g) => g.groupId));
  return voters.map((voter) => {
    // .at(0) keeps the possibly-undefined type honest (no roll entry yet).
    const entry = voter.voterElections.at(0);
    const excluded = entry ? !entry.isEligible : false;
    const eligible =
      !excluded &&
      (election.eligibilityMode === EligibilityMode.ALL_VOTERS ||
        (election.eligibilityMode === EligibilityMode.GROUPS &&
          voter.groupMemberships.some((m) => scopedGroupIds.has(m.groupId))) ||
        (election.eligibilityMode === EligibilityMode.ROLL &&
          Boolean(entry?.isEligible)));
    return {
      accreditedAt: entry?.accreditedAt ?? null,
      codeIssued: Boolean(entry?.voteCodeIssuedAt),
      eligible,
      hasVoted: entry?.hasVoted ?? false,
      id: voter.id,
      name: voter.name,
      phoneNumber: voter.phoneNumber,
      profilePicture: voter.profilePicture,
      voterId: voter.voterId,
    };
  });
};

/**
 * Mark a voter accredited (checked-in) for an election. When the election
 * issues one-time codes, a fresh code is generated (hashed at rest) and
 * returned ONCE for the accreditor to hand to the voter - re-accrediting
 * replaces any earlier, unused code.
 */
export const accreditVoter = async (
  actor: { id: string; role: Role },
  electionId: string,
  voterId: string,
  ctx: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ accreditedAt: Date; voteCode?: string }> => {
  const voter = await prisma.voter.findFirst({
    select: { id: true },
    where: { id: voterId },
  });
  if (!voter) throw new NotFoundError('Voter not found');
  const election = await prisma.election.findFirst({
    select: { voteCodeEnabled: true },
    where: { id: electionId },
  });
  if (!election) throw new NotFoundError('Election not found');

  const existing = await prisma.voterElection.findUnique({
    select: { hasVoted: true, isEligible: true },
    where: { voterId_electionId: { electionId, voterId } },
  });
  if (existing && !existing.isEligible) {
    throw new ForbiddenError('This voter is excluded from the election', {
      code: 'NOT_ELIGIBLE',
      layer: 'accreditation',
    });
  }
  if (existing?.hasVoted) {
    throw new ConflictError('This voter has already voted', {
      code: 'ALREADY_VOTED',
      layer: 'accreditation',
    });
  }

  const accreditedAt = new Date();
  const voteCode = election.voteCodeEnabled ? generateReceiptCode(2, 4) : undefined;
  const codeFields = voteCode
    ? {
        voteCodeHash: sha256(voteCode),
        voteCodeIssuedAt: accreditedAt,
        voteCodeUsedAt: null,
      }
    : {};
  await prisma.voterElection.upsert({
    create: { accreditedAt, accreditedById: actor.id, electionId, voterId, ...codeFields },
    update: { accreditedAt, accreditedById: actor.id, ...codeFields },
    where: { voterId_electionId: { electionId, voterId } },
  });
  await appendAudit(prisma, {
    action: 'voter.accredited',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Voter',
    entityId: voterId,
    ipAddress: ctx.ipAddress,
    metadata: { codeIssued: Boolean(voteCode), electionId },
    userAgent: ctx.userAgent,
  });
  return { accreditedAt, ...(voteCode ? { voteCode } : {}) };
};

/** Undo a mistaken accreditation (super-admin only; refused after voting). */
export const revokeAccreditation = async (
  actor: { id: string; role: Role },
  electionId: string,
  voterId: string,
  ctx: { ipAddress?: string; userAgent?: string } = {},
): Promise<void> => {
  const entry = await prisma.voterElection.findUnique({
    select: { accreditedAt: true, hasVoted: true, id: true },
    where: { voterId_electionId: { electionId, voterId } },
  });
  if (!entry?.accreditedAt) throw new NotFoundError('Voter is not accredited');
  if (entry.hasVoted) {
    throw new ConflictError('This voter has already voted; accreditation stands', {
      code: 'ALREADY_VOTED',
      layer: 'accreditation',
    });
  }
  await prisma.voterElection.update({
    data: {
      accreditedAt: null,
      accreditedById: null,
      voteCodeHash: null,
      voteCodeIssuedAt: null,
      voteCodeUsedAt: null,
    },
    where: { id: entry.id },
  });
  await appendAudit(prisma, {
    action: 'voter.accreditation_revoked',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Voter',
    entityId: voterId,
    ipAddress: ctx.ipAddress,
    metadata: { electionId },
    userAgent: ctx.userAgent,
  });
};

/** Live turnout for one election: eligible, accredited, and voted counts. */
export const getTurnout = async (electionId: string) => {
  const election = await prisma.election.findFirst({
    select: { eligibilityMode: true, id: true, name: true },
    where: { id: electionId },
  });
  if (!election) throw new NotFoundError('Election not found');

  const [voted, accredited, rollEligible, allVoters, groupEligible] =
    await Promise.all([
      prisma.voterElection.count({ where: { electionId, hasVoted: true } }),
      prisma.voterElection.count({
        where: { accreditedAt: { not: null }, electionId },
      }),
      prisma.voterElection.count({ where: { electionId, isEligible: true } }),
      prisma.voter.count(),
      prisma.voter.count({
        where: {
          groupMemberships: {
            some: { group: { electionEligibility: { some: { electionId } } } },
          },
        },
      }),
    ]);
  const eligible =
    election.eligibilityMode === EligibilityMode.ALL_VOTERS
      ? allVoters
      : election.eligibilityMode === EligibilityMode.GROUPS
        ? groupEligible
        : rollEligible;
  return {
    accredited,
    election: { id: election.id, name: election.name },
    eligible,
    percentage: eligible > 0 ? Number(((voted / eligible) * 100).toFixed(2)) : 0,
    voted,
  };
};

/** Sign a voter in with their one-time accreditation code (single-use). */
export const verifyVoteCode = async (
  voterIdNumber: string,
  code: string,
): Promise<{ userId: string; voterId: string }> => {
  // Generic error: never reveal which part was wrong.
  const invalid = () =>
    new BadRequestError('Invalid voter ID or code', {
      code: 'INVALID_VOTE_CODE',
      layer: 'accreditation',
    });
  const voter = await prisma.voter.findUnique({
    select: { id: true, name: true, userId: true, voterId: true },
    where: { voterId: voterIdNumber },
  });
  if (!voter) throw invalid();

  const now = new Date();
  const entries = await prisma.voterElection.findMany({
    select: { id: true, voteCodeHash: true },
    where: {
      election: {
        endDate: { gte: now },
        startDate: { lte: now },
        status: 'IN_PROGRESS',
      },
      voteCodeHash: { not: null },
      voteCodeUsedAt: null,
      voterId: voter.id,
    },
  });
  const codeHash = sha256(code.trim().toUpperCase());
  const match = entries.find((entry) => entry.voteCodeHash === codeHash);
  if (!match) throw invalid();

  // Single-use: claim atomically so a replayed code cannot sign in twice.
  const claimed = await prisma.voterElection.updateMany({
    data: { voteCodeUsedAt: now },
    where: { id: match.id, voteCodeUsedAt: null },
  });
  if (claimed.count !== 1) throw invalid();

  // Voters signing in by code may have no login account yet (same lazy
  // creation as the OTP path).
  let userId = voter.userId;
  if (!userId) {
    const user = await prisma.user.create({
      data: {
        firstName: voter.name.split(' ')[0] || voter.name,
        lastName: voter.name.split(' ').slice(1).join(' ') || '-',
        role: 'VOTER',
      },
      select: { id: true },
    });
    await prisma.voter.update({ data: { userId: user.id }, where: { id: voter.id } });
    userId = user.id;
  }
  await appendAudit(prisma, {
    action: 'voter.code_login',
    actorId: userId,
    actorRole: 'VOTER',
    entity: 'Voter',
    entityId: voter.id,
  });
  return { userId, voterId: voter.voterId };
};

/**
 * Elections a voter can see: open ones (their window is live) plus published
 * upcoming ones (SCHEDULED - admins make an election visible by scheduling
 * it; drafts stay invisible). Scoped by election-level eligibility:
 * group-scoped elections outside the voter's groups are invisible, not
 * merely refused. Carries the voter's standing so the portal can show
 * accreditation and voting state per election.
 */
/**
 * Admin kill-switch: an election with settings.hiddenFromVoters = true never
 * reaches the voter portal (upcoming, open, or history) - so a commission can
 * clear the console down to only the election that matters on voting day.
 * Checked in JS, not SQL: a JSON-path filter under NOT silently drops rows
 * whose settings column is NULL (three-valued logic), which is most of them.
 */
const isHiddenFromVoters = (settings: unknown): boolean =>
  (settings as null | { hiddenFromVoters?: unknown })?.hiddenFromVoters === true;

/** Search + period filters shared by the voter's election and history lists. */
export interface VoterListFilters {
  from?: Date;
  search?: string;
  to?: Date;
}

const matchesVoterFilters = (
  election: { endDate: Date; name: string; startDate: Date },
  filters: VoterListFilters,
): boolean => {
  if (
    filters.search &&
    !election.name.toLowerCase().includes(filters.search.trim().toLowerCase())
  ) {
    return false;
  }
  if (filters.from && election.endDate < filters.from) return false;
  if (filters.to && election.startDate > filters.to) return false;
  return true;
};

export const listVoterElections = async (
  userId: string,
  filters: VoterListFilters,
  pagination: PaginationParams,
) => {
  const empty = { data: [], meta: buildMeta(0, pagination.page, pagination.limit) };
  const voter = await prisma.voter.findFirst({
    select: { id: true },
    where: { userId },
  });
  if (!voter) return empty;
  const now = new Date();
  const visibility = await electionVisibilityFilter(voter.id);
  const elections = await prisma.election.findMany({
    orderBy: { startDate: 'asc' },
    select: {
      accreditationRequired: true,
      description: true,
      endDate: true,
      id: true,
      name: true,
      resultsPolicy: true,
      resultsPublishedAt: true,
      settings: true,
      slug: true,
      startDate: true,
      status: true,
      voterElections: {
        select: { accreditedAt: true, hasVoted: true, isEligible: true },
        where: { voterId: voter.id },
      },
    },
    where: {
      ...visibility,
      endDate: { gte: now },
      status: { in: ['IN_PROGRESS', 'SCHEDULED'] },
    },
  });
  // Hidden + search/period filters run in JS (JSON-null semantics make the
  // SQL filter unreliable); elections are institutionally few, so the page
  // is sliced here - the CLIENT still gets true server-side pagination.
  const visible = elections.filter(
    (e) => !isHiddenFromVoters(e.settings) && matchesVoterFilters(e, filters),
  );
  return {
    data: visible.slice(pagination.skip, pagination.skip + pagination.limit),
    meta: buildMeta(visible.length, pagination.page, pagination.limit),
  };
};

/**
 * The voter's own voting history: every election they voted in (hidden ones
 * excluded) and when.
 *
 * What they voted appears ONLY for open-ballot elections
 * (Election.voteVisibleToVoter), which are the ones that deliberately store
 * the link. For a secret ballot nothing on the row points at the ballot, so
 * there is nothing to replay - here or for anyone with database access - and
 * the voter verifies with the receipt they kept.
 */
export const getVoterHistory = async (
  userId: string,
  filters: VoterListFilters,
  pagination: PaginationParams,
) => {
  const empty = { data: [], meta: buildMeta(0, pagination.page, pagination.limit) };
  const voter = await prisma.voter.findFirst({
    select: { id: true },
    where: { userId },
  });
  if (!voter) return empty;

  const entries = await prisma.voterElection.findMany({
    orderBy: { votedAt: 'desc' },
    select: {
      election: {
        select: {
          endDate: true,
          id: true,
          name: true,
          resultsPolicy: true,
          resultsPublishedAt: true,
          settings: true,
          slug: true,
          startDate: true,
          status: true,
          voteVisibleToVoter: true,
        },
      },
      receiptCode: true,
      votedAt: true,
    },
    where: { hasVoted: true, voterId: voter.id },
  });
  const visible = entries.filter(
    (e) =>
      !isHiddenFromVoters(e.election.settings) &&
      matchesVoterFilters(e.election, filters),
  );
  const pageRows = visible.slice(pagination.skip, pagination.skip + pagination.limit);

  const data = await Promise.all(
    pageRows.map(async (entry) => {
      // Only an open ballot has a stored receipt to replay from. The
      // election flag is checked as well as the column, so flipping an
      // election back to secret hides the replay immediately even before the
      // purge lands.
      const replay =
        entry.election.voteVisibleToVoter && entry.receiptCode
          ? await prisma.ballot.findUnique({
              select: {
                entries: {
                  select: {
                    approve: true,
                    candidate: { select: { name: true, profilePicture: true } },
                    portfolio: { select: { name: true } },
                    type: true,
                  },
                },
              },
              where: { receiptCode: entry.receiptCode },
            })
          : null;
      return {
        choices: replay?.entries ?? null,
        election: entry.election,
        receiptCode: entry.election.voteVisibleToVoter ? entry.receiptCode : null,
        votedAt: entry.votedAt,
      };
    }),
  );

  return { data, meta: buildMeta(visible.length, pagination.page, pagination.limit) };
};
