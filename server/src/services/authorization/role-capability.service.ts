// src/services/authorization/role-capability.service.ts
//
// The runtime role → capability matrix (DMS RolePermission pattern). Grants
// live in the RoleCapability table so super-admins can retune what each role
// may do without a deploy; reads go through a short in-process cache because
// every authorized request consults the matrix.
import { type Capability, type Role } from '../../../generated/prisma/client.js';
import {
  CAPABILITY_CATALOG,
  DEFAULT_ROLE_CAPABILITIES,
  EDITABLE_ROLES,
  type EditableRole,
  isEditableRole,
} from '../../config/capabilities.js';
import prisma from '../../lib/prisma.js';
import { BadRequestError } from '../../middlewares/error-handler.js';
import { appendAudit } from '../audit/audit.service.js';

const CACHE_TTL_MS = 60_000;

interface MatrixCache {
  expiresAt: number;
  sets: Record<EditableRole, Set<Capability>>;
}

let cache: MatrixCache | null = null;

export const invalidateRoleCapabilityCache = (): void => {
  cache = null;
};

const emptyMatrix = (): Record<EditableRole, Set<Capability>> =>
  Object.fromEntries(EDITABLE_ROLES.map((role) => [role, new Set<Capability>()])) as Record<
    EditableRole,
    Set<Capability>
  >;

/** The stored matrix as per-role capability sets (cached ~60s). */
export const getRoleCapabilitySets = async (): Promise<
  Record<EditableRole, Set<Capability>>
> => {
  if (cache && cache.expiresAt > Date.now()) return cache.sets;

  const rows = await prisma.roleCapability.findMany({
    select: { capability: true, role: true },
  });

  const sets = emptyMatrix();
  if (rows.length === 0) {
    // Completely unseeded database (fresh deploy before its first seed):
    // fall back to the shipped defaults rather than locking everyone out.
    for (const role of EDITABLE_ROLES) {
      for (const capability of DEFAULT_ROLE_CAPABILITIES[role]) sets[role].add(capability);
    }
  } else {
    for (const row of rows) {
      if (isEditableRole(row.role)) sets[row.role].add(row.capability);
    }
  }

  cache = { expiresAt: Date.now() + CACHE_TTL_MS, sets };
  return sets;
};

/** Catalog + current grants, shaped for the console matrix page. */
export const listCapabilityMatrix = async () => {
  const sets = await getRoleCapabilitySets();
  return {
    catalog: CAPABILITY_CATALOG,
    editableRoles: [...EDITABLE_ROLES],
    matrix: Object.fromEntries(
      EDITABLE_ROLES.map((role) => [role, [...sets[role]]]),
    ) as Record<EditableRole, Capability[]>,
  };
};

/** Replace one role's grants transactionally, audited, cache invalidated. */
export const replaceRoleCapabilities = async (
  role: Role,
  capabilities: Capability[],
  actor: { id: string; role: Role },
  ctx?: { ipAddress?: string; userAgent?: string },
) => {
  if (!isEditableRole(role)) {
    throw new BadRequestError('This role cannot be edited', {
      code: 'ROLE_NOT_EDITABLE',
      layer: 'permissions',
    });
  }
  const unique = [...new Set(capabilities)];

  await prisma.$transaction(async (tx) => {
    await tx.roleCapability.deleteMany({ where: { role } });
    if (unique.length > 0) {
      await tx.roleCapability.createMany({
        data: unique.map((capability) => ({ capability, role })),
      });
    }
    await appendAudit(tx, {
      action: 'permissions.role_updated',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'RoleCapability',
      entityId: role,
      ipAddress: ctx?.ipAddress ?? null,
      metadata: { capabilities: unique },
      userAgent: ctx?.userAgent ?? null,
    });
  });

  invalidateRoleCapabilityCache();
  return { capabilities: unique, role };
};
