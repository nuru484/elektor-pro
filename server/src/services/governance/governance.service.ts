import {
  type Capability,
  Role,
  type Status as UserStatus,
} from '../../../generated/prisma/client.js';
// src/services/governance/governance.service.ts
// Staff/agent/candidate account creation, agent assignments, and capability
// grants. These account-level actions are super-admin / capability gated and
// apply directly (not via maker-checker), always audited.
import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { hashPassword } from '../../utils/password.js';
import { generateTempPassword } from '../../utils/temp-password.js';
import { appendAudit } from '../audit/audit.service.js';
import { canApproveChanges } from '../authorization/capability.service.js';
import { defaultDeps } from '../deps.js';

interface Actor { id: string; role: Role }
interface Ctx { ipAddress?: string; userAgent?: string }

const STAFF_ROLES = new Set<Role>([
  Role.ACCREDITOR,
  Role.ADMIN,
  Role.AGENT,
  Role.CANDIDATE,
]);

export interface StaffUserInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: Role;
}

/**
 * Super-admin creates a staff/agent/candidate/accreditor account. The system
 * generates a temporary password (never chosen by the admin), emails it to
 * the new user, returns it ONCE in the response, and forces a change on
 * first sign-in before the account can be used.
 */
export const createStaffUser = async (
  actor: Actor,
  input: StaffUserInput,
  ctx: Ctx = {},
): Promise<{ id: string; temporaryPassword: string }> => {
  if (actor.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError('Only a super administrator can create accounts');
  }
  if (!STAFF_ROLES.has(input.role)) {
    throw new BadRequestError('Role must be ADMIN, AGENT, CANDIDATE or ACCREDITOR');
  }
  const temporaryPassword = generateTempPassword();
  const user = await prisma.user.create({
    data: {
      createdById: actor.id,
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      mustChangePassword: true,
      password: await hashPassword(temporaryPassword),
      phone: input.phone ?? null,
      role: input.role,
    },
    select: { id: true },
  });
  // Best-effort credential delivery; the admin also sees the password once.
  try {
    await defaultDeps.mail.send({
      email: input.email.toLowerCase(),
      subject: 'Your Elektor Pro account',
      text: `Hello ${input.firstName},\n\nAn account has been created for you on Elektor Pro.\n\nTemporary password: ${temporaryPassword}\n\nSign in with your email and this password - you will be asked to set your own password before you can continue.`,
    });
  } catch {
    // Delivery failure must not lose the account; the admin has the password.
  }
  await appendAudit(prisma, {
    action: 'user.created',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'User',
    entityId: user.id,
    ipAddress: ctx.ipAddress,
    metadata: { role: input.role },
    userAgent: ctx.userAgent,
  });
  return { id: user.id, temporaryPassword };
};

export const listStaffUsers = async (
  filters: {
    from?: Date;
    role?: Role;
    search?: string;
    status?: UserStatus;
    to?: Date;
  },
  pagination: PaginationParams,
) => {
  const where = {
    // The Users tab holds staff only; agents/candidates live in their own
    // modules and appear here only when explicitly filtered (role=AGENT is
    // how the agents page lists assignable accounts).
    role: filters.role ?? {
      in: [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCREDITOR],
    },
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lt: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { firstName: { contains: filters.search, mode: 'insensitive' as const } },
            { lastName: { contains: filters.search, mode: 'insensitive' as const } },
            { email: { contains: filters.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        email: true,
        firstName: true,
        id: true,
        lastName: true,
        lockedAt: true,
        phone: true,
        role: true,
        status: true,
        twoFactorEnabled: true,
      },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.user.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

// --- Agent assignments ---

export const assignAgent = async (
  actor: Actor,
  input: { candidateId?: string; electionId: string; userId: string },
  ctx: Ctx = {},
): Promise<{ id: string }> => {
  const user = await prisma.user.findUnique({
    select: { role: true },
    where: { id: input.userId },
  });
  if (user?.role !== Role.AGENT) {
    throw new BadRequestError('User is not an agent');
  }
  const assignment = await prisma.agentAssignment.create({
    data: {
      candidateId: input.candidateId ?? null,
      electionId: input.electionId,
      userId: input.userId,
    },
    select: { id: true },
  });
  await appendAudit(prisma, {
    action: 'agent.assigned',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'AgentAssignment',
    entityId: assignment.id,
    ipAddress: ctx.ipAddress,
    metadata: { electionId: input.electionId, userId: input.userId },
    userAgent: ctx.userAgent,
  });
  return assignment;
};

export const listAgentAssignments = async (
  filters: { electionId?: string; from?: Date; search?: string; to?: Date },
  pagination: PaginationParams,
) => {
  const where = {
    ...(filters.electionId ? { electionId: filters.electionId } : {}),
    ...(filters.search
      ? {
          OR: [
            { user: { firstName: { contains: filters.search, mode: 'insensitive' as const } } },
            { user: { lastName: { contains: filters.search, mode: 'insensitive' as const } } },
            { candidate: { name: { contains: filters.search, mode: 'insensitive' as const } } },
            { election: { name: { contains: filters.search, mode: 'insensitive' as const } } },
          ],
        }
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
    prisma.agentAssignment.findMany({
      include: {
        candidate: { select: { id: true, name: true } },
        election: { select: { id: true, name: true } },
        user: { select: { email: true, firstName: true, id: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.agentAssignment.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const removeAgentAssignment = async (
  actor: Actor,
  id: string,
): Promise<void> => {
  if (!canApproveChanges(actor.role)) {
    throw new ForbiddenError('Only a super administrator can remove assignments');
  }
  const found = await prisma.agentAssignment.findUnique({ select: { id: true }, where: { id } });
  if (!found) throw new NotFoundError('Assignment not found');
  await prisma.agentAssignment.delete({ where: { id } });
};

// --- Capability grants ---

export const grantCapability = async (
  actor: Actor,
  input: { capability: Capability; electionId?: string; expiresAt?: Date; userId: string },
  ctx: Ctx = {},
): Promise<{ id: string }> => {
  if (actor.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError('Only a super administrator can grant capabilities');
  }
  const electionId = input.electionId ?? null;
  const existing = await prisma.accessGrant.findFirst({
    select: { id: true },
    where: { capability: input.capability, electionId, userId: input.userId },
  });
  const grant = existing
    ? await prisma.accessGrant.update({
        data: { expiresAt: input.expiresAt ?? null, grantedById: actor.id, revokedAt: null },
        select: { id: true },
        where: { id: existing.id },
      })
    : await prisma.accessGrant.create({
        data: {
          capability: input.capability,
          electionId,
          expiresAt: input.expiresAt ?? null,
          grantedById: actor.id,
          userId: input.userId,
        },
        select: { id: true },
      });
  await appendAudit(prisma, {
    action: 'grant.issued',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'AccessGrant',
    entityId: grant.id,
    ipAddress: ctx.ipAddress,
    metadata: { capability: input.capability, userId: input.userId },
    userAgent: ctx.userAgent,
  });
  return grant;
};

export const listGrants = async (
  filters: {
    capability?: Capability;
    electionId?: string;
    from?: Date;
    to?: Date;
    userId?: string;
  },
  pagination: PaginationParams,
) => {
  const where = {
    revokedAt: null,
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.electionId ? { electionId: filters.electionId } : {}),
    ...(filters.capability ? { capability: filters.capability } : {}),
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
    prisma.accessGrant.findMany({
      include: {
        election: { select: { id: true, name: true } },
        user: { select: { email: true, firstName: true, id: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.accessGrant.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const revokeGrant = async (actor: Actor, id: string): Promise<void> => {
  if (actor.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError('Only a super administrator can revoke grants');
  }
  await prisma.accessGrant.update({ data: { revokedAt: new Date() }, where: { id } });
};
