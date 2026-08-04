// src/services/users/user-admin.service.ts
//
// Administrative user management (list/inspect/update/deactivate accounts).
// Distinct from profile self-service: these are actions an admin performs ON
// another account, so every mutation takes the acting user and is audited.
// Role changes and deletion stay super-admin-only; nobody can act on their
// own account here (self-service goes through the profile endpoints).
import {
  OtpPurpose,
  type Prisma,
  Role,
  Status,
} from '../../../generated/prisma/client.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { ConflictError } from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { validateAndFormatPhone } from '../../utils/validate-phone.js';
import { appendAudit } from '../audit/audit.service.js';
import { type RequestContext, STAFF_SELECT } from '../auth/auth.service.js';
import { makeOtpService } from '../auth/otp.service.js';
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

/** Role tiers for administer-checks: an actor may only touch accounts on a
 * strictly LOWER tier (super-admins may touch anyone, incl. other SAs). */
const ROLE_RANK: Record<Role, number> = {
  [Role.ACCREDITOR]: 1,
  [Role.ADMIN]: 2,
  [Role.AGENT]: 1,
  [Role.CANDIDATE]: 0,
  [Role.SUPER_ADMIN]: 3,
  [Role.VOTER]: 0,
};

const assertCanAdminister = (actor: Actor, targetRole: Role): void => {
  if (actor.role === Role.SUPER_ADMIN) return;
  if (ROLE_RANK[actor.role] <= ROLE_RANK[targetRole]) {
    throw new ForbiddenError(
      'You cannot modify an account with equal or higher privileges',
    );
  }
};

const USER_ADMIN_SELECT = {
  ...STAFF_SELECT,
  creator: { select: { firstName: true, id: true, lastName: true } },
  lockedAt: true,
} as const;

export const makeUserAdminService = (
  d: Pick<AppDeps, 'clock' | 'config' | 'logger' | 'mail' | 'prisma' | 'sms'>,
) => {
  const { prisma } = d;
  const sessions = makeSessionService(d);
  const otp = makeOtpService(d);

  /** Uniqueness checks shared by both contact-change paths. */
  const assertContactFree = async (
    userId: string,
    contact: { email?: string; phone?: string },
  ) => {
    if (contact.email) {
      const taken = await prisma.user.findUnique({
        select: { id: true },
        where: { email: contact.email },
      });
      if (taken && taken.id !== userId) {
        throw new ConflictError('That email address is already in use');
      }
    }
    if (contact.phone) {
      const taken = await prisma.user.findUnique({
        select: { id: true },
        where: { phone: contact.phone },
      });
      if (taken && taken.id !== userId) {
        throw new ConflictError('That phone number is already in use');
      }
    }
  };

  /**
   * SUPER-ADMIN ONLY: change another account's email/phone directly (the UI
   * gates it behind a typed confirmation). Admins and self-service must use
   * the OTP-verified paths so unreachable contacts never enter the system.
   */
  const updateUserContact = async (
    actor: Actor,
    userId: string,
    input: { email?: string; phone?: string },
    ctx: RequestContext,
  ) => {
    if (actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenError(
        'Only a super administrator can change contact details without verification',
      );
    }
    if (actor.id === userId) {
      throw new BadRequestError('Use your profile to edit your own account');
    }
    const target = await prisma.user.findFirst({
      select: { id: true, role: true },
      where: { id: userId },
    });
    if (!target) throw new NotFoundError('User not found');

    const email = input.email?.toLowerCase().trim();
    const phone = input.phone
      ? validateAndFormatPhone(input.phone, 'GH').e164Format
      : undefined;
    await assertContactFree(userId, { email, phone });

    const updated = await prisma.user.update({
      data: {
        ...(email ? { email, emailVerifiedAt: null } : {}),
        ...(phone ? { phone, phoneVerifiedAt: null } : {}),
      },
      select: USER_ADMIN_SELECT,
      where: { id: userId },
    });
    await appendAudit(prisma, {
      action: 'user.contact_changed',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      metadata: { direct: true, email: email ?? null, phone: phone ?? null },
      userAgent: ctx.userAgent,
    });
    return updated;
  };

  /**
   * Admin path step 1: stage the new contact and send a code TO IT - the
   * code proves the address/number is live and reachable before it can be
   * attached to the account.
   */
  const requestUserContactChange = async (
    actor: Actor,
    userId: string,
    input: { email?: string; phone?: string },
  ): Promise<{ ttlMinutes: number }> => {
    if (actor.id === userId) {
      throw new BadRequestError('Use your profile to edit your own account');
    }
    const target = await prisma.user.findFirst({
      select: { id: true, role: true },
      where: { id: userId },
    });
    if (!target) throw new NotFoundError('User not found');
    // A contact change is an account-takeover primitive (email -> password
    // reset), so only strictly higher tiers may stage one.
    assertCanAdminister(actor, target.role);

    if (input.email) {
      const email = input.email.toLowerCase().trim();
      await assertContactFree(userId, { email });
      await prisma.user.update({ data: { pendingEmail: email }, where: { id: userId } });
      const issued = await otp.issue(userId, OtpPurpose.EMAIL_CHANGE);
      await d.mail.send({
        email,
        subject: 'Confirm this email for your Elektor Pro account',
        text: `An administrator is setting this email on an Elektor Pro account. Confirmation code: ${issued.code}. It expires in ${issued.ttlMinutes} minutes.`,
      });
      return { ttlMinutes: issued.ttlMinutes };
    }
    if (input.phone) {
      const phone = validateAndFormatPhone(input.phone, 'GH').e164Format;
      await assertContactFree(userId, { phone });
      await prisma.user.update({ data: { pendingPhone: phone }, where: { id: userId } });
      const issued = await otp.issue(userId, OtpPurpose.PHONE_CHANGE);
      await d.sms.send(
        phone,
        `Elektor Pro confirmation code: ${issued.code}. It expires in ${issued.ttlMinutes} minutes.`,
      );
      return { ttlMinutes: issued.ttlMinutes };
    }
    throw new BadRequestError('Provide an email or a phone number');
  };

  /** Admin path step 2: the code from the new contact applies the change. */
  const confirmUserContactChange = async (
    actor: Actor,
    userId: string,
    code: string,
    ctx: RequestContext,
  ) => {
    const target = await prisma.user.findFirst({
      select: { id: true, pendingEmail: true, pendingPhone: true, role: true },
      where: { id: userId },
    });
    if (!target) throw new NotFoundError('User not found');
    assertCanAdminister(actor, target.role);
    if (!target.pendingEmail && !target.pendingPhone) {
      throw new BadRequestError('No contact change in progress');
    }

    if (target.pendingEmail) {
      await otp.verify(userId, OtpPurpose.EMAIL_CHANGE, code);
    } else {
      await otp.verify(userId, OtpPurpose.PHONE_CHANGE, code);
    }
    const updated = await prisma.user.update({
      data: target.pendingEmail
        ? { email: target.pendingEmail, emailVerifiedAt: d.clock.now(), pendingEmail: null }
        : { pendingPhone: null, phone: target.pendingPhone, phoneVerifiedAt: d.clock.now() },
      select: USER_ADMIN_SELECT,
      where: { id: userId },
    });
    await appendAudit(prisma, {
      action: 'user.contact_changed',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      metadata: {
        email: target.pendingEmail ?? null,
        phone: target.pendingPhone ?? null,
        verified: true,
      },
      userAgent: ctx.userAgent,
    });
    return updated;
  };

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
    if (target.role === Role.AGENT || target.role === Role.CANDIDATE || target.role === Role.VOTER) {
      throw new BadRequestError(
        'This account belongs to its own module and cannot change staff role',
      );
    }

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

  return {
    confirmUserContactChange,
    deleteUser,
    getUser,
    listUsers,
    requestUserContactChange,
    updateUser,
    updateUserContact,
    updateUserRole,
  };
};

export type UserAdminService = ReturnType<typeof makeUserAdminService>;

export const userAdminService = makeUserAdminService(defaultDeps);
