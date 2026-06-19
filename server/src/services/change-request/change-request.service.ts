import type { TxClient } from '../../types/prisma.types.js';
import type {
  Applier,
  ChangeActor,
  ChangeContext,
  ProposeInput,
} from './types.js';

import {
  ChangeAction,
  type ChangeEntity,
  ChangeStatus,
  type Prisma,
} from '../../../generated/prisma/client.js';
// src/services/change-request/change-request.service.ts
// Maker-checker governance engine. Admin mutations are staged as pending change
// requests; super-admin mutations apply immediately. Both are audited.
import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { appendAudit } from '../audit/audit.service.js';
import { canApproveChanges, canDelete } from '../authorization/capability.service.js';
import { appliers } from './registry.js';

const runApplier = (
  applier: Applier,
  input: { action: ChangeAction; entityId?: null | string; payload: unknown },
  actorId: string,
  tx: TxClient,
): Promise<{ id: string }> => {
  switch (input.action) {
    case ChangeAction.CREATE:
      if (!applier.create) throw new BadRequestError('Create not supported');
      return applier.create(tx, input.payload, actorId);
    case ChangeAction.DELETE:
      if (!applier.remove || !input.entityId) {
        throw new BadRequestError('Delete not supported');
      }
      return applier.remove(tx, input.entityId, actorId);
    case ChangeAction.UPDATE:
      if (!applier.update || !input.entityId) {
        throw new BadRequestError('Update not supported');
      }
      return applier.update(tx, input.entityId, input.payload, actorId);
    default:
      throw new BadRequestError('Unknown change action');
  }
};

/**
 * Either apply the change immediately (super-admin) or stage it as a pending
 * change request (admin). Deletes are super-admin only and never staged.
 */
export const proposeOrExecute = async (
  actor: ChangeActor,
  input: ProposeInput,
  ctx: ChangeContext = {},
): Promise<
  | { applied: false; changeRequest: { id: string; status: ChangeStatus } }
  | { applied: true; result: { id: string } }
> => {
  if (input.action === ChangeAction.DELETE && !canDelete(actor.role)) {
    throw new ForbiddenError('Only a super administrator can delete resources');
  }
  const applier = appliers[input.entity];
  if (!applier) throw new BadRequestError(`Unsupported entity: ${input.entity}`);

  if (canApproveChanges(actor.role)) {
    const result = await prisma.$transaction(async (tx) => {
      const r = await runApplier(
        applier,
        { action: input.action, entityId: input.entityId, payload: input.payload },
        actor.id,
        tx,
      );
      await appendAudit(tx, {
        action: `${input.entity}.${input.action}`.toLowerCase(),
        actorId: actor.id,
        actorRole: actor.role,
        entity: input.entity,
        entityId: r.id,
        ipAddress: ctx.ipAddress,
        metadata: { direct: true, summary: input.summary },
        userAgent: ctx.userAgent,
      });
      return r;
    });
    return { applied: true, result };
  }

  const cr = await prisma.changeRequest.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      payload: input.payload as Prisma.InputJsonValue,
      requestedById: actor.id,
      summary: input.summary ?? null,
    },
    select: { id: true, status: true },
  });
  await appendAudit(prisma, {
    action: 'change_request.submitted',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'ChangeRequest',
    entityId: cr.id,
    ipAddress: ctx.ipAddress,
    metadata: { action: input.action, targetEntity: input.entity },
    userAgent: ctx.userAgent,
  });
  return { applied: false, changeRequest: cr };
};

export const approveChangeRequest = async (
  actor: ChangeActor,
  id: string,
  note: string | undefined,
  ctx: ChangeContext = {},
): Promise<{ id: string }> => {
  if (!canApproveChanges(actor.role)) {
    throw new ForbiddenError('Only a super administrator can approve changes');
  }
  const cr = await prisma.changeRequest.findUnique({ where: { id } });
  if (!cr) throw new NotFoundError('Change request not found');
  if (cr.status !== ChangeStatus.PENDING) {
    throw new BadRequestError('Change request is not pending');
  }
  const applier = appliers[cr.entity];
  if (!applier) throw new BadRequestError(`Unsupported entity: ${cr.entity}`);

  try {
    return await prisma.$transaction(async (tx) => {
      const r = await runApplier(
        applier,
        { action: cr.action, entityId: cr.entityId, payload: cr.payload },
        cr.requestedById,
        tx,
      );
      await tx.changeRequest.update({
        data: {
          appliedAt: new Date(),
          resultId: r.id,
          reviewedAt: new Date(),
          reviewedById: actor.id,
          reviewNote: note ?? null,
          status: ChangeStatus.APPLIED,
        },
        where: { id },
      });
      await appendAudit(tx, {
        action: 'change_request.approved',
        actorId: actor.id,
        actorRole: actor.role,
        entity: cr.entity,
        entityId: r.id,
        ipAddress: ctx.ipAddress,
        metadata: { action: cr.action, changeRequestId: id },
        userAgent: ctx.userAgent,
      });
      return r;
    });
  } catch (error) {
    await prisma.changeRequest.update({
      data: {
        error: error instanceof Error ? error.message : String(error),
        reviewedAt: new Date(),
        reviewedById: actor.id,
        status: ChangeStatus.FAILED,
      },
      where: { id },
    });
    throw error;
  }
};

export const rejectChangeRequest = async (
  actor: ChangeActor,
  id: string,
  note: string | undefined,
  ctx: ChangeContext = {},
): Promise<void> => {
  if (!canApproveChanges(actor.role)) {
    throw new ForbiddenError('Only a super administrator can reject changes');
  }
  const cr = await prisma.changeRequest.findUnique({
    select: { entity: true, status: true },
    where: { id },
  });
  if (!cr) throw new NotFoundError('Change request not found');
  if (cr.status !== ChangeStatus.PENDING) {
    throw new BadRequestError('Change request is not pending');
  }
  await prisma.changeRequest.update({
    data: {
      reviewedAt: new Date(),
      reviewedById: actor.id,
      reviewNote: note ?? null,
      status: ChangeStatus.REJECTED,
    },
    where: { id },
  });
  await appendAudit(prisma, {
    action: 'change_request.rejected',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'ChangeRequest',
    entityId: id,
    ipAddress: ctx.ipAddress,
    metadata: { note },
    userAgent: ctx.userAgent,
  });
};

export const cancelChangeRequest = async (
  actor: ChangeActor,
  id: string,
): Promise<void> => {
  const cr = await prisma.changeRequest.findUnique({
    select: { requestedById: true, status: true },
    where: { id },
  });
  if (!cr) throw new NotFoundError('Change request not found');
  if (cr.requestedById !== actor.id && !canApproveChanges(actor.role)) {
    throw new ForbiddenError('You can only cancel your own change requests');
  }
  if (cr.status !== ChangeStatus.PENDING) {
    throw new BadRequestError('Change request is not pending');
  }
  await prisma.changeRequest.update({
    data: { status: ChangeStatus.CANCELLED },
    where: { id },
  });
};

const CHANGE_INCLUDE = {
  requestedBy: { select: { email: true, firstName: true, id: true, lastName: true } },
  reviewedBy: { select: { email: true, firstName: true, id: true, lastName: true } },
} as const;

export const listChangeRequests = async (
  filters: { entity?: ChangeEntity; requestedById?: string; status?: ChangeStatus },
  pagination: PaginationParams,
) => {
  const where: Prisma.ChangeRequestWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.requestedById ? { requestedById: filters.requestedById } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.changeRequest.findMany({
      include: CHANGE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.changeRequest.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const getChangeRequest = async (id: string) => {
  const cr = await prisma.changeRequest.findUnique({
    include: CHANGE_INCLUDE,
    where: { id },
  });
  if (!cr) throw new NotFoundError('Change request not found');
  return cr;
};
