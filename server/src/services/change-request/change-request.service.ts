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
  Role,
} from '../../../generated/prisma/client.js';
// src/services/change-request/change-request.service.ts
// Maker-checker governance engine. Admin mutations are staged as pending change
// requests; super-admin mutations apply immediately. Both are audited.
import { withCredentialPool } from '../../lib/credential-pool.js';
import { withOutbox } from '../../lib/outbox.js';
import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { appendAudit } from '../audit/audit.service.js';
import { canActorApproveChanges, canDelete } from '../authorization/capability.service.js';
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
 * A bulk import's work scales with its payload, so the default 5s interactive
 * transaction budget is the wrong shape for this path: 20 candidate rows
 * already exceeded it. Everything expensive that does NOT need the database
 * has been moved out (credential hashing below, notifications into the
 * outbox), so what remains is pure database work - but a 1000-row import is
 * still a lot of it, and timing out here means losing the whole import.
 */
const APPLY_TIMEOUT_MS = 120_000;

/**
 * Run an applier inside a transaction with the two escapes it needs:
 *
 *  - a CREDENTIAL POOL, filled before the transaction opens, so bcrypt (slow
 *    by design, and once per account created) never runs on the transaction's
 *    critical path;
 *  - an OUTBOX, drained after it commits, so credential emails and SMS never
 *    run inside the transaction and never go out for a change that rolled
 *    back.
 *
 * Both were real failures, not theory: a bulk import of two nominations blew
 * the transaction budget on SMTP, and twenty blew it on hashing.
 */
const applyInTransaction = async <T>(
  applier: Applier,
  input: { action: ChangeAction; payload: unknown },
  work: (tx: TxClient) => Promise<T>,
): Promise<T> => {
  const credentials = applier.credentialCount?.(input.action, input.payload) ?? 0;
  return withOutbox(() =>
    withCredentialPool(credentials, () =>
      prisma.$transaction(work, { timeout: APPLY_TIMEOUT_MS }),
    ),
  );
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

  // A super administrator IS the approver: their actions always apply
  // directly - there is nobody above them to approve. Other roles apply
  // directly only when the matrix or a grant gives them APPROVE_CHANGES.
  if (actor.role === Role.SUPER_ADMIN || (await canActorApproveChanges(actor))) {
    const result = await applyInTransaction(applier, input, async (tx) => {
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
  if (!(await canActorApproveChanges(actor))) {
    throw new ForbiddenError('You are not allowed to approve changes');
  }
  const cr = await prisma.changeRequest.findUnique({ where: { id } });
  if (!cr) throw new NotFoundError('Change request not found');
  // Four eyes, actually. The capability check alone let anyone who gained
  // APPROVE_CHANGES after submitting sign off their own request, which is
  // exactly the review this queue exists to force. Cancel it and resubmit, or
  // have someone else approve.
  if (cr.requestedById === actor.id) {
    throw new ForbiddenError('You cannot approve your own change request', {
      code: 'SELF_APPROVAL',
      layer: 'governance',
    });
  }
  if (cr.status !== ChangeStatus.PENDING) {
    throw new BadRequestError('Change request is not pending');
  }
  const applier = appliers[cr.entity];
  if (!applier) throw new BadRequestError(`Unsupported entity: ${cr.entity}`);

  try {
    // Same escapes as the direct path: a staged bulk import is applied HERE,
    // at approval time, so it needs them just as much.
    return await applyInTransaction(applier, cr, async (tx) => {
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
  if (!(await canActorApproveChanges(actor))) {
    throw new ForbiddenError('You are not allowed to reject changes');
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
  if (cr.requestedById !== actor.id && !(await canActorApproveChanges(actor))) {
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
  filters: {
    entity?: ChangeEntity;
    /** Inclusive lower bound on createdAt. */
    from?: Date;
    requestedById?: string;
    /** Free-text match on the request summary. */
    search?: string;
    status?: ChangeStatus;
    /** EXCLUSIVE upper bound on createdAt (callers pass day-after). */
    to?: Date;
  },
  pagination: PaginationParams,
) => {
  const where: Prisma.ChangeRequestWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.requestedById ? { requestedById: filters.requestedById } : {}),
    ...(filters.search
      ? { summary: { contains: filters.search, mode: 'insensitive' as const } }
      : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lt: filters.to } : {}),
          },
        }
      : {}),
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
