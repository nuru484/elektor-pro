// src/services/users/user-admin.service.ts
//
// Administrative user management (list/inspect/update/deactivate accounts).
// Distinct from profile self-service: these are actions an admin performs ON
// another account, so every mutation takes the acting user and is audited.
// Role changes and deletion stay super-admin-only; nobody can act on their
// own account here (self-service goes through the profile endpoints).
import {
  type Prisma,
  Role,
  Status,
} from '../../../generated/prisma/client.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { appendAudit } from '../audit/audit.service.js';
import { type RequestContext, STAFF_SELECT } from '../auth/auth.service.js';
import { makeSessionService } from '../auth/session.service.js';
import { type AppDeps, defaultDeps } from '../deps.js';

export interface AdminUserUpdateInput {
  firstName?: string;
  lastName?: string;
  status?: Status;
}

export interface UserQueryFilters {
  role?: Role;
  search?: string;
  status?: Status;
}

interface Actor {
  id: string;
  role: Role;
}

const USER_ADMIN_SELECT = {
  ...STAFF_SELECT,
  creator: { select: { firstName: true, id: true, lastName: true } },
  lockedAt: true,
} as const;

export const makeUserAdminService = (d: Pick<AppDeps, 'clock' | 'prisma'>) => {
  const { prisma } = d;
  const sessions = makeSessionService(d);

  const listUsers = async (filters: UserQueryFilters, pagination: PaginationParams) => {
    const where: Prisma.UserWhereInput = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
              { phone: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: USER_ADMIN_SELECT,
        skip: pagination.skip,
        take: pagination.limit,
        where,
      }),
      prisma.user.count({ where }),
    ]);
    return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
  };

  const getUser = async (userId: string) => {
    const user = await prisma.user.findFirst({
      select: USER_ADMIN_SELECT,
      where: { id: userId },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  };

  /** Admin edits an account's names/status. Suspension revokes all sessions. */
  const updateUser = async (
    actor: Actor,
    userId: string,
    input: AdminUserUpdateInput,
    ctx: RequestContext,
  ) => {
    if (actor.id === userId) {
      throw new BadRequestError('Use your profile to edit your own account');
    }
    const target = await prisma.user.findFirst({
      select: { id: true, role: true },
      where: { id: userId },
    });
    if (!target) throw new NotFoundError('User not found');
    // Only a super-admin may act on another super-admin's account.
    if (target.role === Role.SUPER_ADMIN && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenError('Only a super administrator can modify this account');
    }

    const updated = await prisma.user.update({
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: USER_ADMIN_SELECT,
      where: { id: userId },
    });
    if (input.status === Status.SUSPENDED || input.status === Status.INACTIVE) {
      await sessions.revokeAllSessions(userId);
    }
    await appendAudit(prisma, {
      action: 'user.updated',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      metadata: { fields: Object.keys(input) },
      userAgent: ctx.userAgent,
    });
    return updated;
  };

  /** Super-admin changes a role. Sessions are revoked so the change binds. */
  const updateUserRole = async (
    actor: Actor,
    userId: string,
    role: Role,
    ctx: RequestContext,
  ) => {
    if (actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenError('Only a super administrator can change roles');
    }
    if (actor.id === userId) {
      throw new BadRequestError('You cannot change your own role');
    }
    const target = await prisma.user.findFirst({
      select: { id: true, role: true },
      where: { id: userId },
    });
    if (!target) throw new NotFoundError('User not found');

    const updated = await prisma.user.update({
      data: { role },
      select: USER_ADMIN_SELECT,
      where: { id: userId },
    });
    // Access tokens embed the role; kill sessions so a demotion applies now.
    await sessions.revokeAllSessions(userId);
    await appendAudit(prisma, {
      action: 'user.role_changed',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      metadata: { from: target.role, to: role },
      userAgent: ctx.userAgent,
    });
    return updated;
  };

  /** Super-admin soft-deletes an account and kills its sessions. */
  const deleteUser = async (actor: Actor, userId: string, ctx: RequestContext): Promise<void> => {
    if (actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenError('Only a super administrator can delete accounts');
    }
    if (actor.id === userId) {
      throw new BadRequestError('You cannot delete your own account');
    }
    const target = await prisma.user.findFirst({
      select: { id: true },
      where: { id: userId },
    });
    if (!target) throw new NotFoundError('User not found');

    await prisma.user.delete({ where: { id: userId } }); // soft delete (extension)
    await sessions.revokeAllSessions(userId);
    await appendAudit(prisma, {
      action: 'user.deleted',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  };

  return { deleteUser, getUser, listUsers, updateUser, updateUserRole };
};

export type UserAdminService = ReturnType<typeof makeUserAdminService>;

export const userAdminService = makeUserAdminService(defaultDeps);
