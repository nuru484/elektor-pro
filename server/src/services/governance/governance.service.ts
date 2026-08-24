import {
  type Capability,
  ElectionStatus,
  Role,
  type Status as UserStatus,
} from '../../../generated/prisma/client.js';
import { LIVE_ELECTION_STATUSES } from '../../config/constants.js';
import ENV from '../../config/env.js';
// src/services/governance/governance.service.ts
// Staff/agent/candidate account creation, agent assignments, and capability
// grants. These account-level actions are super-admin / capability gated and
// apply directly (not via maker-checker), always audited.
import { afterCommit } from '../../lib/outbox.js';
import prisma from '../../lib/prisma.js';
import { buildCredentialsEmail } from '../../mail/account-emails.js';
import {
  BadRequestError,
  ConflictError,
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
  /** Set by the upload middleware only - never client-supplied. */
  profilePicture?: string;
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
      profilePicture: input.profilePicture ?? null,
      role: input.role,
    },
    select: { id: true },
  });
  // Queued after the transaction commits: the admin does not wait on the
  // provider, credentials never go out for an account that then rolls back,
  // and a refused send is retried instead of quietly stranding the new user
  // with no way in but a password reset.
  afterCommit(() =>
    defaultDeps.queueMail.enqueue({
      ...buildCredentialsEmail(
        input.firstName,
        temporaryPassword,
        `${ENV.FRONTEND_URL.replace(/\/+$/, '')}/login`,
        { identifier: input.email.toLowerCase() },
      ),
      email: input.email.toLowerCase(),
    }),
  );
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
        profilePicture: true,
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
  // One live posting at a time, for the same reason as accreditors: an agent
  // observes one candidate at one election, and a second live assignment
  // would mean they are expected in two rooms at once.
  const conflict = await prisma.agentAssignment.findFirst({
    select: { election: { select: { name: true } } },
    where: {
      election: { status: { in: [...LIVE_ELECTION_STATUSES] } },
      electionId: { not: input.electionId },
      userId: input.userId,
    },
  });
  if (conflict) {
    throw new ConflictError(
      `This agent is already assigned to ${conflict.election.name}. Remove that assignment first - an agent can only observe one live election at a time.`,
      { code: 'AGENT_ALREADY_ASSIGNED' },
    );
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
        user: { select: { email: true, firstName: true, id: true, lastName: true, phone: true, profilePicture: true } },
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

// --- Accreditor assignments ---

/**
 * Put an accreditor on an election's desk.
 *
 * Holding ACCREDIT_VOTERS is not enough on its own: without an assignment an
 * accreditor would see - and could work - every election in the
 * organization. The assignment is what scopes them to one.
 */
export const assignAccreditor = async (
  actor: Actor,
  input: { electionId: string; userId: string },
  ctx: Ctx = {},
): Promise<{ id: string }> => {
  const user = await prisma.user.findUnique({
    select: { role: true },
    where: { id: input.userId },
  });
  if (user?.role !== Role.ACCREDITOR) {
    throw new BadRequestError('User is not an accreditor');
  }
  const election = await prisma.election.findUnique({
    select: { id: true },
    where: { id: input.electionId },
  });
  if (!election) throw new NotFoundError('Election not found');

  // One live desk at a time: an accreditor physically staffs one election,
  // so a second live posting is a mistake worth refusing rather than a
  // capability to model. Finished elections are history and never block.
  const conflict = await prisma.accreditorAssignment.findFirst({
    select: { election: { select: { name: true } } },
    where: {
      election: { status: { in: [...LIVE_ELECTION_STATUSES] } },
      electionId: { not: input.electionId },
      userId: input.userId,
    },
  });
  if (conflict) {
    throw new ConflictError(
      `This accreditor is already assigned to ${conflict.election.name}. Remove that assignment first - an accreditor can only staff one live election at a time.`,
      { code: 'ACCREDITOR_ALREADY_ASSIGNED' },
    );
  }

  // Re-assigning is a no-op rather than a duplicate-key error: the admin's
  // intent ("this person works this election") is already satisfied, and a
  // previously removed assignment is restored by clearing deletedAt.
  const assignment = await prisma.accreditorAssignment.upsert({
    create: { electionId: input.electionId, userId: input.userId },
    select: { id: true },
    update: { deletedAt: null },
    where: {
      userId_electionId: { electionId: input.electionId, userId: input.userId },
    },
  });
  await appendAudit(prisma, {
    action: 'accreditor.assigned',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'AccreditorAssignment',
    entityId: assignment.id,
    ipAddress: ctx.ipAddress,
    metadata: { electionId: input.electionId, userId: input.userId },
    userAgent: ctx.userAgent,
  });
  return assignment;
};

export const listAccreditorAssignments = async (
  filters: { electionId?: string; search?: string; userId?: string },
  pagination: PaginationParams,
) => {
  const where = {
    ...(filters.electionId ? { electionId: filters.electionId } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.search
      ? {
          OR: [
            { user: { firstName: { contains: filters.search, mode: 'insensitive' as const } } },
            { user: { lastName: { contains: filters.search, mode: 'insensitive' as const } } },
            { election: { name: { contains: filters.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.accreditorAssignment.findMany({
      include: {
        election: { select: { endDate: true, id: true, name: true, startDate: true, status: true } },
        user: { select: { email: true, firstName: true, id: true, lastName: true, phone: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.accreditorAssignment.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const removeAccreditorAssignment = async (
  actor: Actor,
  id: string,
  ctx: Ctx = {},
): Promise<void> => {
  const found = await prisma.accreditorAssignment.findFirst({
    select: { electionId: true, id: true, userId: true },
    where: { id },
  });
  if (!found) throw new NotFoundError('Assignment not found');
  await prisma.accreditorAssignment.delete({ where: { id } });
  await appendAudit(prisma, {
    action: 'accreditor.unassigned',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'AccreditorAssignment',
    entityId: id,
    ipAddress: ctx.ipAddress,
    metadata: { electionId: found.electionId, userId: found.userId },
    userAgent: ctx.userAgent,
  });
};

const DESK_ELECTION_SELECT = {
  accreditationRequired: true,
  endDate: true,
  id: true,
  name: true,
  resultsPolicy: true,
  resultsPublishedAt: true,
  slug: true,
  startDate: true,
  status: true,
  voteCodeEnabled: true,
} as const;

/**
 * An accreditor's own console: the one election they are currently posted to,
 * plus every election they have worked before. The split is what the console
 * renders - a desk to work, and a record to look back on - and it is derived
 * from election status rather than stored, so an election ending moves itself
 * into history with no extra write.
 */
export const listMyAccreditationElections = async (userId: string) => {
  const rows = await prisma.accreditorAssignment.findMany({
    orderBy: { election: { startDate: 'desc' } },
    select: { createdAt: true, election: { select: DESK_ELECTION_SELECT } },
    where: { userId },
  });
  const live = new Set<string>(LIVE_ELECTION_STATUSES);
  const current = rows.find((row) => live.has(row.election.status)) ?? null;
  return {
    current: current
      ? { ...current.election, assignedAt: current.createdAt }
      : null,
    history: rows
      .filter((row) => !live.has(row.election.status))
      .map((row) => ({ ...row.election, assignedAt: row.createdAt })),
  };
};

/**
 * Every election a staff member can run a desk for. Admins are not assigned
 * to elections, so their console lists the ones accreditation applies to.
 */
export const listOpenElectionsForDesk = async () => {
  const elections = await prisma.election.findMany({
    orderBy: { startDate: 'desc' },
    select: DESK_ELECTION_SELECT,
    where: {
      status: {
        in: [
          ElectionStatus.SCHEDULED,
          ElectionStatus.IN_PROGRESS,
          ElectionStatus.PAUSED,
        ],
      },
    },
  });
  // Staff are not posted to a single desk; their console lists them all, so
  // every open election is "current" and there is no personal history.
  return { current: null, history: [], staffElections: elections };
};

/**
 * Is this user allowed to work `electionId`'s desk? Staff run every desk;
 * an accreditor needs an assignment. Used by every accreditation endpoint.
 */
export const canAccreditElection = async (
  user: { id: string; role: Role },
  electionId: string,
): Promise<boolean> => {
  if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) return true;
  const assignment = await prisma.accreditorAssignment.findFirst({
    select: { id: true },
    where: { electionId, userId: user.id },
  });
  return assignment !== null;
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
        user: { select: { email: true, firstName: true, id: true, lastName: true, phone: true, profilePicture: true } },
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
