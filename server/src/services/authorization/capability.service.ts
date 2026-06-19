import { Capability, Role } from '../../../generated/prisma/client.js';
// src/services/authorization/capability.service.ts
// Authorization = role defaults + per-user (optionally per-election) grants.
import prisma from '../../lib/prisma.js';

const ALL_CAPABILITIES = Object.values(Capability);

/** Default capabilities granted purely by role. */
const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  [Role.ADMIN]: [
    Capability.MANAGE_ELECTIONS,
    Capability.MANAGE_PORTFOLIOS,
    Capability.MANAGE_CANDIDATES,
    Capability.MANAGE_VOTERS,
    Capability.MANAGE_AGENTS,
    Capability.MANAGE_GROUPS,
    Capability.MANAGE_ORGANIZATION,
    Capability.ACCREDIT_VOTERS,
    Capability.VIEW_RESULTS,
  ],
  [Role.AGENT]: [Capability.VIEW_RESULTS],
  [Role.CANDIDATE]: [],
  [Role.SUPER_ADMIN]: ALL_CAPABILITIES,
  [Role.VOTER]: [],
};

/** Pure role-only check (no DB). */
export const roleHasCapability = (
  role: Role,
  capability: Capability,
): boolean => ROLE_CAPABILITIES[role].includes(capability);

/** Only super-admins may delete (soft-delete) resources. */
export const canDelete = (role: Role): boolean => role === Role.SUPER_ADMIN;

/** Only super-admins may approve maker-checker change requests. */
export const canApproveChanges = (role: Role): boolean =>
  role === Role.SUPER_ADMIN;

/**
 * Full capability check: role default OR an active matching access grant.
 * A grant with a null electionId is global; a scoped grant only applies to its
 * election.
 */
export const hasCapability = async (
  user: { id: string; role: Role },
  capability: Capability,
  electionId?: string,
): Promise<boolean> => {
  if (roleHasCapability(user.role, capability)) return true;

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
