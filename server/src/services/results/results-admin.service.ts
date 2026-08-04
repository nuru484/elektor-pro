import {
  ElectionStatus,
  type Prisma,
  type Role,
} from '../../../generated/prisma/client.js';
import { Capability } from '../../../generated/prisma/client.js';
// src/services/results/results-admin.service.ts
import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { emitElectionUpdate } from '../../realtime/io.js';
import { sha256, stableStringify } from '../../utils/crypto.js';
import { appendAudit } from '../audit/audit.service.js';
import { hasCapability } from '../authorization/capability.service.js';
import { computeResults } from './results.service.js';

interface Actor { id: string; role: Role }
interface Ctx { ipAddress?: string; userAgent?: string }

const requireCertifier = async (actor: Actor): Promise<void> => {
  if (!(await hasCapability(actor, Capability.CERTIFY_RESULTS))) {
    throw new ForbiddenError('You are not allowed to certify or publish results');
  }
};

/** Make results publicly visible without locking the election. */
export const publishResults = async (
  actor: Actor,
  electionId: string,
  ctx: Ctx = {},
): Promise<{ resultsPublishedAt: Date }> => {
  await requireCertifier(actor);
  const election = await prisma.election.findFirst({
    select: { id: true },
    where: { id: electionId },
  });
  if (!election) throw new NotFoundError('Election not found');

  const resultsPublishedAt = new Date();
  await prisma.election.update({
    data: { resultsPublishedAt },
    where: { id: electionId },
  });
  await appendAudit(prisma, {
    action: 'results.published',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Election',
    entityId: electionId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  emitElectionUpdate(electionId, 'results:invalidate', { electionId });
  return { resultsPublishedAt };
};

/**
 * Take published results back down (a mistaken or premature publish).
 * Refused once certified: certification is the final, public record.
 */
export const unpublishResults = async (
  actor: Actor,
  electionId: string,
  ctx: Ctx = {},
): Promise<void> => {
  await requireCertifier(actor);
  const election = await prisma.election.findFirst({
    select: { certifiedAt: true, id: true },
    where: { id: electionId },
  });
  if (!election) throw new NotFoundError('Election not found');
  if (election.certifiedAt) {
    throw new BadRequestError('Certified results cannot be unpublished', {
      code: 'ALREADY_CERTIFIED',
      layer: 'results',
    });
  }
  await prisma.election.update({
    data: { resultsPublishedAt: null },
    where: { id: electionId },
  });
  await appendAudit(prisma, {
    action: 'results.unpublished',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Election',
    entityId: electionId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  emitElectionUpdate(electionId, 'results:invalidate', { electionId });
};

/** Certify final results: snapshot + hash, lock the election, publish. */
export const certifyResults = async (
  actor: Actor,
  electionId: string,
  ctx: Ctx = {},
): Promise<{ hash: string; snapshotId: string }> => {
  await requireCertifier(actor);
  const election = await prisma.election.findFirst({ where: { id: electionId } });
  if (!election) throw new NotFoundError('Election not found');
  if (election.status !== ElectionStatus.ENDED) {
    throw new BadRequestError('Only an ended election can be certified');
  }

  const results = await computeResults(electionId);
  const hash = sha256(stableStringify(results));

  const snapshot = await prisma.$transaction(async (tx) => {
    const snap = await tx.resultSnapshot.create({
      data: {
        certifiedById: actor.id,
        data: results as unknown as Prisma.InputJsonValue,
        electionId,
        hash,
      },
      select: { id: true },
    });
    await tx.election.update({
      data: {
        certifiedAt: new Date(),
        certifiedById: actor.id,
        isLocked: true,
        resultsPublishedAt: election.resultsPublishedAt ?? new Date(),
      },
      where: { id: electionId },
    });
    await appendAudit(tx, {
      action: 'results.certified',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Election',
      entityId: electionId,
      ipAddress: ctx.ipAddress,
      metadata: { hash, snapshotId: snap.id },
      userAgent: ctx.userAgent,
    });
    return snap;
  });

  emitElectionUpdate(electionId, 'results:invalidate', { electionId });
  return { hash, snapshotId: snapshot.id };
};

export const getCertification = async (electionId: string) => {
  const snapshot = await prisma.resultSnapshot.findFirst({
    include: {
      certifiedBy: { select: { firstName: true, id: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
    where: { electionId },
  });
  if (!snapshot) throw new NotFoundError('Election has not been certified');
  return snapshot;
};
