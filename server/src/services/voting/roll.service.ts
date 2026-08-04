// src/services/voting/roll.service.ts
//
// Election roll management: the explicit per-election voter register that
// powers EligibilityMode.ROLL, per-voter exclusions in any mode, and the
// accreditation/turnout ledger. Rows are VoterElection records; adding to the
// roll marks voters eligible, and removal is only allowed while the row has
// no history (no vote, no accreditation) - after that, exclusion is the
// reversible path so turnout facts are never destroyed.
import type { Prisma, Role } from '../../../generated/prisma/client.js';

import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { appendAudit } from '../audit/audit.service.js';
import { assertElectionUnlocked } from '../domain/election.service.js';

interface Actor {
  id: string;
  role: Role;
}

interface Ctx {
  ipAddress?: string;
  userAgent?: string;
}

const requireElection = async (electionId: string): Promise<{ id: string }> => {
  const election = await prisma.election.findFirst({
    select: { id: true },
    where: { id: electionId },
  });
  if (!election) throw new NotFoundError('Election not found');
  return election;
};

const ROLL_INCLUDE = {
  voter: {
    select: {
      email: true,
      groupMemberships: {
        select: { group: { select: { id: true, name: true } } },
      },
      id: true,
      name: true,
      phoneNumber: true,
      profilePicture: true,
      voterId: true,
    },
  },
} as const;

export const listRoll = async (
  electionId: string,
  filters: {
    accredited?: boolean;
    eligible?: boolean;
    search?: string;
    voted?: boolean;
  },
  pagination: PaginationParams,
) => {
  await requireElection(electionId);
  const where: Prisma.VoterElectionWhereInput = {
    electionId,
    ...(filters.eligible === undefined ? {} : { isEligible: filters.eligible }),
    ...(filters.voted === undefined ? {} : { hasVoted: filters.voted }),
    ...(filters.accredited === undefined
      ? {}
      : { accreditedAt: filters.accredited ? { not: null } : null }),
    ...(filters.search
      ? {
          voter: {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { voterId: { contains: filters.search, mode: 'insensitive' } },
              { phoneNumber: { contains: filters.search, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.voterElection.findMany({
      include: ROLL_INCLUDE,
      orderBy: { voter: { name: 'asc' } },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.voterElection.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

/**
 * Add voters to the roll (marked eligible), by explicit ids and/or by a whole
 * group's membership. Re-adding an excluded voter re-enables them; voters
 * already on the roll are counted, not duplicated.
 */
export const addToRoll = async (
  actor: Actor,
  electionId: string,
  input: { groupId?: string; voterIds?: string[] },
  ctx: Ctx = {},
): Promise<{ added: number; alreadyEligible: number; reEnabled: number }> => {
  await requireElection(electionId);
  await assertElectionUnlocked(prisma, electionId);

  const ids = new Set(input.voterIds ?? []);
  if (input.voterIds?.length) {
    const found = await prisma.voter.count({
      where: { id: { in: [...ids] } },
    });
    if (found !== ids.size) {
      throw new BadRequestError('One or more voters do not exist', {
        code: 'UNKNOWN_VOTER',
        layer: 'roll',
      });
    }
  }
  if (input.groupId) {
    const group = await prisma.group.findFirst({
      select: { id: true },
      where: { id: input.groupId },
    });
    if (!group) {
      throw new BadRequestError('Group does not exist', {
        code: 'UNKNOWN_GROUP',
        layer: 'roll',
      });
    }
    const members = await prisma.voterGroupMembership.findMany({
      select: { voterId: true },
      where: { groupId: input.groupId },
    });
    for (const member of members) ids.add(member.voterId);
  }
  if (ids.size === 0) {
    throw new BadRequestError('Nothing to add: no voters selected', {
      code: 'EMPTY_ROLL_SELECTION',
      layer: 'roll',
    });
  }

  const voterIds = [...ids];
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.voterElection.findMany({
      select: { isEligible: true, voterId: true },
      where: { electionId, voterId: { in: voterIds } },
    });
    const existingIds = new Set(existing.map((e) => e.voterId));
    const created = await tx.voterElection.createMany({
      data: voterIds
        .filter((voterId) => !existingIds.has(voterId))
        .map((voterId) => ({ electionId, isEligible: true, voterId })),
      skipDuplicates: true,
    });
    const reEnabled = await tx.voterElection.updateMany({
      data: { isEligible: true },
      where: { electionId, isEligible: false, voterId: { in: voterIds } },
    });
    await appendAudit(tx, {
      action: 'election.roll_added',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Election',
      entityId: electionId,
      ipAddress: ctx.ipAddress,
      metadata: {
        added: created.count,
        groupId: input.groupId ?? null,
        reEnabled: reEnabled.count,
        selected: voterIds.length,
      },
      userAgent: ctx.userAgent,
    });
    return {
      added: created.count,
      alreadyEligible: voterIds.length - created.count - reEnabled.count,
      reEnabled: reEnabled.count,
    };
  });
  return result;
};

/**
 * Flip a voter's eligibility on the roll. Setting false is the admin
 * exclusion switch and works in every eligibility mode; a missing row is
 * created so an exclusion can be recorded before the voter ever interacts.
 */
export const setRollEligibility = async (
  actor: Actor,
  electionId: string,
  voterId: string,
  isEligible: boolean,
  ctx: Ctx = {},
): Promise<{ isEligible: boolean }> => {
  await requireElection(electionId);
  await assertElectionUnlocked(prisma, electionId);
  const voter = await prisma.voter.findFirst({
    select: { id: true },
    where: { id: voterId },
  });
  if (!voter) throw new NotFoundError('Voter not found');

  await prisma.voterElection.upsert({
    create: { electionId, isEligible, voterId },
    update: { isEligible },
    where: { voterId_electionId: { electionId, voterId } },
  });
  await appendAudit(prisma, {
    action: isEligible ? 'election.roll_enabled' : 'election.roll_excluded',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Election',
    entityId: electionId,
    ipAddress: ctx.ipAddress,
    metadata: { voterId },
    userAgent: ctx.userAgent,
  });
  return { isEligible };
};

/**
 * Remove a roll entry entirely. Refused once the row carries history (a vote
 * or an accreditation) - those facts feed turnout and the audit story; use
 * exclusion instead.
 */
export const removeFromRoll = async (
  actor: Actor,
  electionId: string,
  voterId: string,
  ctx: Ctx = {},
): Promise<void> => {
  await requireElection(electionId);
  await assertElectionUnlocked(prisma, electionId);
  const entry = await prisma.voterElection.findUnique({
    select: { accreditedAt: true, hasVoted: true, id: true },
    where: { voterId_electionId: { electionId, voterId } },
  });
  if (!entry) throw new NotFoundError('Voter is not on this roll');
  if (entry.hasVoted || entry.accreditedAt) {
    throw new ConflictError(
      'This voter has voting history on the roll; mark them ineligible instead',
      { code: 'ROLL_ENTRY_HAS_HISTORY', layer: 'roll' },
    );
  }
  await prisma.voterElection.delete({ where: { id: entry.id } });
  await appendAudit(prisma, {
    action: 'election.roll_removed',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Election',
    entityId: electionId,
    ipAddress: ctx.ipAddress,
    metadata: { voterId },
    userAgent: ctx.userAgent,
  });
};
