import type { Role } from '../../../generated/prisma/client.js';

// src/services/voting/accreditation.service.ts
import prisma from '../../lib/prisma.js';
import { NotFoundError } from '../../middlewares/error-handler.js';
import { appendAudit } from '../audit/audit.service.js';
import { electionVisibilityFilter } from './eligibility.service.js';

/** Mark a voter accredited (checked-in) for an election. */
export const accreditVoter = async (
  actor: { id: string; role: Role },
  electionId: string,
  voterId: string,
  ctx: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ accreditedAt: Date }> => {
  const voter = await prisma.voter.findFirst({
    select: { id: true },
    where: { id: voterId },
  });
  if (!voter) throw new NotFoundError('Voter not found');

  const accreditedAt = new Date();
  await prisma.voterElection.upsert({
    create: { accreditedAt, accreditedById: actor.id, electionId, voterId },
    update: { accreditedAt, accreditedById: actor.id },
    where: { voterId_electionId: { electionId, voterId } },
  });
  await appendAudit(prisma, {
    action: 'voter.accredited',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Voter',
    entityId: voterId,
    ipAddress: ctx.ipAddress,
    metadata: { electionId },
    userAgent: ctx.userAgent,
  });
  return { accreditedAt };
};

/**
 * Elections a voter can currently participate in (open + within window),
 * scoped by election-level eligibility: group-scoped elections outside the
 * voter's groups are invisible, not merely refused.
 */
export const listVoterElections = async (userId: string) => {
  const voter = await prisma.voter.findFirst({
    select: { id: true },
    where: { userId },
  });
  if (!voter) return [];
  const now = new Date();
  const visibility = await electionVisibilityFilter(voter.id);
  return prisma.election.findMany({
    orderBy: { startDate: 'asc' },
    select: {
      description: true,
      endDate: true,
      id: true,
      name: true,
      slug: true,
      startDate: true,
      status: true,
      voterElections: {
        select: { hasVoted: true },
        where: { voterId: voter.id },
      },
    },
    where: {
      ...visibility,
      endDate: { gte: now },
      status: 'IN_PROGRESS',
    },
  });
};
