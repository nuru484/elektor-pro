// src/services/domain/entity-picture.service.ts
//
// Standalone profile-photo updates for voters and candidates. Binary assets
// can't ride maker-checker JSON, so these apply directly - capability-gated
// at the route, audited here, old asset reclaimed after a successful swap.
import { type Role } from '../../../generated/prisma/client.js';
import prisma from '../../lib/prisma.js';
import { NotFoundError } from '../../middlewares/error-handler.js';
import { appendAudit } from '../audit/audit.service.js';
import { type AppDeps, defaultDeps } from '../deps.js';
import { assertElectionUnlocked } from './election.service.js';

/** Candidate assets are election-scoped: certification freezes them too. */
const assertCandidateElectionUnlocked = async (candidateId: string): Promise<void> => {
  const candidate = await prisma.candidate.findUnique({
    select: { electionId: true },
    where: { id: candidateId },
  });
  if (candidate) await assertElectionUnlocked(prisma, candidate.electionId);
};

interface Actor {
  id: string;
  role: Role;
}

interface Ctx {
  ipAddress?: string;
  userAgent?: string;
}

export const makeEntityPictureService = (
  d: Pick<AppDeps, 'cloudinary' | 'logger'>,
) => {
  const swap = async (
    entity: 'candidate' | 'voter',
    id: string,
    image: { buffer: Buffer; mimetype?: string },
    actor: Actor,
    ctx: Ctx,
  ) => {
    if (entity === 'candidate') await assertCandidateElectionUnlocked(id);
    const delegate = entity === 'voter' ? prisma.voter : prisma.candidate;
    const existing = (await (delegate as typeof prisma.voter).findFirst({
      select: { id: true, profilePicture: true },
      where: { id },
    }));
    if (!existing) {
      throw new NotFoundError(entity === 'voter' ? 'Voter not found' : 'Candidate not found');
    }

    const uploaded = await d.cloudinary.uploadImage(image, {
      folder: `elektor-pro/${entity}s`,
    });
    const updated = await (delegate as typeof prisma.voter).update({
      data: { profilePicture: uploaded.secure_url },
      where: { id },
    });
    if (existing.profilePicture && existing.profilePicture !== uploaded.secure_url) {
      try {
        await d.cloudinary.deleteImage(existing.profilePicture);
      } catch (error) {
        d.logger.warn({ entity, error, id }, 'Old profile picture cleanup failed');
      }
    }
    await appendAudit(prisma, {
      action: `${entity}.picture_updated`,
      actorId: actor.id,
      actorRole: actor.role,
      entity: entity === 'voter' ? 'Voter' : 'Candidate',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return updated;
  };

  /** Replace a candidate's manifesto PDF (standalone, audited). */
  const updateCandidateManifesto = async (
    id: string,
    file: { buffer: Buffer; mimetype?: string },
    actor: Actor,
    ctx: Ctx = {},
  ) => {
    await assertCandidateElectionUnlocked(id);
    const existing = await prisma.candidate.findFirst({
      select: { id: true, manifestoUrl: true },
      where: { id },
    });
    if (!existing) throw new NotFoundError('Candidate not found');
    const uploaded = await d.cloudinary.uploadImage(file, {
      folder: 'elektor-pro/manifestos',
      resource_type: 'auto',
    });
    const updated = await prisma.candidate.update({
      data: { manifestoUrl: uploaded.secure_url },
      where: { id },
    });
    if (existing.manifestoUrl && existing.manifestoUrl !== uploaded.secure_url) {
      try {
        await d.cloudinary.deleteImage(existing.manifestoUrl);
      } catch (error) {
        d.logger.warn({ error, id }, 'Old manifesto cleanup failed');
      }
    }
    await appendAudit(prisma, {
      action: 'candidate.manifesto_updated',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Candidate',
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return updated;
  };

  return {
    updateCandidateManifesto,
    updateCandidatePicture: (
      id: string,
      image: { buffer: Buffer; mimetype?: string },
      actor: Actor,
      ctx: Ctx = {},
    ) => swap('candidate', id, image, actor, ctx),
    updateVoterPicture: (
      id: string,
      image: { buffer: Buffer; mimetype?: string },
      actor: Actor,
      ctx: Ctx = {},
    ) => swap('voter', id, image, actor, ctx),
  };
};

export const entityPictureService = makeEntityPictureService(defaultDeps);
export const { updateCandidateManifesto, updateCandidatePicture, updateVoterPicture } =
  entityPictureService;
