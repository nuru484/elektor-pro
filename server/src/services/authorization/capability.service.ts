import { Capability, Role } from '../../../generated/prisma/client.js';
// src/services/authorization/capability.service.ts
// Authorization = runtime role matrix (RoleCapability table, cached) + per-
// user (optionally per-election) AccessGrant rows. SUPER_ADMIN implicitly
// holds everything; VOTER never holds role capabilities.
import { isEditableRole } from '../../config/capabilities.js';
import prisma from '../../lib/prisma.js';
import { getRoleCapabilitySets } from './role-capability.service.js';

const ALL_CAPABILITIES = Object.values(Capability);
const ALL_SET: ReadonlySet<Capability> = new Set(ALL_CAPABILITIES);
const EMPTY_SET: ReadonlySet<Capability> = new Set();

/** The role's capabilities per the runtime matrix. */
const roleCapabilities = async (role: Role): Promise<ReadonlySet<Capability>> => {
  if (role === Role.SUPER_ADMIN) return ALL_SET;
  if (!isEditableRole(role)) return EMPTY_SET;
  const sets = await getRoleCapabilitySets();
  return sets[role];
};

/** Only super-admins may delete (soft-delete) resources. */
export const canDelete = (role: Role): boolean => role === Role.SUPER_ADMIN;

/**
 * Hard super-admin gate. Kept for actions that are policy-locked to the top
 * role regardless of the matrix (e.g. removing agent assignments).
 */
export const canApproveChanges = (role: Role): boolean =>
  role === Role.SUPER_ADMIN;

/**
 * Matrix-aware approver check for the maker-checker flow: super-admins
 * always; other roles when the runtime matrix or a personal grant gives them
 * APPROVE_CHANGES.
 */
export const canActorApproveChanges = (actor: {
  id: string;
  role: Role;
}): Promise<boolean> => hasCapability(actor, Capability.APPROVE_CHANGES);

/**
 * Full capability check: runtime role matrix OR an active matching access
 * grant. A grant with a null electionId is global; a scoped grant only
 * applies to its election.
 */
export const hasCapability = async (
  user: { id: string; role: Role },
  capability: Capability,
  electionId?: string,
): Promise<boolean> => {
  if ((await roleCapabilities(user.role)).has(capability)) return true;

  const now = new Date();
  const grant = await prisma.accessGrant.findFirst({
    select: { id: true },
    where: {
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        electionId
          ? { OR: [{ electionId }, { electionId: null }] }
          : { electionId: null },
      ],
      capability,
      revokedAt: null,
      userId: user.id,
    },
  });

  return Boolean(grant);
};

/**
 * The capabilities a user effectively holds everywhere: runtime role matrix
 * plus active GLOBAL grants (election-scoped grants only apply in context and
 * are deliberately excluded). Returned in auth payloads so the client can
 * gate navigation and actions; the server always re-checks.
 */
export const getEffectiveCapabilities = async (user: {
  id: string;
  role: Role;
}): Promise<Capability[]> => {
  if (user.role === Role.SUPER_ADMIN) return [...ALL_CAPABILITIES];

  const capabilities = new Set(await roleCapabilities(user.role));
  const now = new Date();
  const grants = await prisma.accessGrant.findMany({
    select: { capability: true },
    where: {
      electionId: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      revokedAt: null,
      userId: user.id,
    },
  });
  for (const grant of grants) capabilities.add(grant.capability);
  return [...capabilities];
};
