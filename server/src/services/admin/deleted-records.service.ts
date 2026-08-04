// src/services/admin/deleted-records.service.ts
//
// The deleted-records manager (DMS pattern): super-admins can review what
// has been soft-deleted, restore a row, or purge it permanently. Reads pass
// an explicit `deletedAt` filter to opt out of the soft-delete extension's
// scoping; the purge goes through the sanctioned `purgeRecord` seam.
import { type Role } from '../../../generated/prisma/client.js';
import prisma, {
  purgeRecord,
  type SoftDeleteModelAccessor,
} from '../../lib/prisma.js';
import {
  BadRequestError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { appendAudit } from '../audit/audit.service.js';

export interface IDeletedRow {
  createdAt: Date;
  deletedAt: Date;
  id: string;
  label: string;
  meta: null | string;
}

interface Actor {
  id: string;
  role: Role;
}

interface Ctx {
  ipAddress?: string;
  userAgent?: string;
}

interface DeletedRecordShape {
  [key: string]: unknown;
  createdAt: Date;
  deletedAt: Date | null;
  id: string;
}

interface ResourceConfig {
  accessor: SoftDeleteModelAccessor;
  entity: string;
  /** Human labels for the list rows. */
  toRow: (record: DeletedRecordShape) => { label: string; meta: null | string };
}

const s = (value: unknown): string => (typeof value === 'string' ? value : '');

export const DELETED_RESOURCES = {
  candidates: {
    accessor: 'candidate',
    entity: 'Candidate',
    toRow: (r) => ({ label: s(r.name), meta: s(r.party) || null }),
  },
  elections: {
    accessor: 'election',
    entity: 'Election',
    toRow: (r) => ({ label: s(r.name), meta: s(r.slug) || null }),
  },
  'group-categories': {
    accessor: 'groupCategory',
    entity: 'GroupCategory',
    toRow: (r) => ({ label: s(r.name), meta: s(r.code) || null }),
  },
  groups: {
    accessor: 'group',
    entity: 'Group',
    toRow: (r) => ({ label: s(r.name), meta: s(r.code) || null }),
  },
  portfolios: {
    accessor: 'portfolio',
    entity: 'Portfolio',
    toRow: (r) => ({ label: s(r.name), meta: null }),
  },
  users: {
    accessor: 'user',
    entity: 'User',
    toRow: (r) => ({
      label: `${s(r.firstName)} ${s(r.lastName)}`.trim(),
      meta: s(r.email) || s(r.phone) || null,
    }),
  },
  voters: {
    accessor: 'voter',
    entity: 'Voter',
    toRow: (r) => ({ label: s(r.name), meta: s(r.voterId) || null }),
  },
} satisfies Record<string, ResourceConfig>;

export type DeletedResource = keyof typeof DELETED_RESOURCES;

export const DELETED_RESOURCE_KEYS = Object.keys(
  DELETED_RESOURCES,
) as DeletedResource[];

interface Delegate {
  count: (args: { where: Record<string, unknown> }) => Promise<number>;
  findMany: (args: {
    orderBy: Record<string, string>;
    skip: number;
    take: number;
    where: Record<string, unknown>;
  }) => Promise<DeletedRecordShape[]>;
  findUnique: (args: {
    where: { id: string };
  }) => Promise<DeletedRecordShape | null>;
  update: (args: {
    data: { deletedAt: null };
    where: { id: string };
  }) => Promise<unknown>;
}

const delegateFor = (resource: DeletedResource): Delegate =>
  (prisma as unknown as Record<SoftDeleteModelAccessor, Delegate>)[
    DELETED_RESOURCES[resource].accessor
  ];

/** Per-resource counts of soft-deleted rows. */
export const summarizeDeleted = async (): Promise<
  { count: number; resource: DeletedResource }[]
> =>
  Promise.all(
    DELETED_RESOURCE_KEYS.map(async (resource) => ({
      count: await delegateFor(resource).count({
        where: { deletedAt: { not: null } },
      }),
      resource,
    })),
  );

/** Paginated soft-deleted rows, optionally windowed on the deletion date. */
export const listDeleted = async (
  resource: DeletedResource,
  filters: { from?: Date; to?: Date },
  pagination: PaginationParams,
) => {
  const delegate = delegateFor(resource);
  const where = {
    deletedAt: {
      not: null,
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lt: filters.to } : {}),
    },
  };
  const [records, total] = await Promise.all([
    delegate.findMany({
      orderBy: { deletedAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    delegate.count({ where }),
  ]);
  const data: IDeletedRow[] = records.map((record) => ({
    createdAt: record.createdAt,
    // The where clause guarantees deletedAt is set.
    deletedAt: record.deletedAt ?? record.createdAt,
    id: record.id,
    ...DELETED_RESOURCES[resource].toRow(record),
  }));
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

/** Look a soft-deleted row up or fail with the right error. */
const requireDeleted = async (resource: DeletedResource, id: string) => {
  const record = await delegateFor(resource).findUnique({ where: { id } });
  if (!record) throw new NotFoundError('Record not found');
  if (!record.deletedAt) {
    throw new BadRequestError('This record is not deleted', {
      code: 'RECORD_NOT_DELETED',
      layer: 'deleted-records',
    });
  }
  return record;
};

export const restoreDeleted = async (
  resource: DeletedResource,
  id: string,
  actor: Actor,
  ctx: Ctx = {},
): Promise<IDeletedRow> => {
  const record = await requireDeleted(resource, id);
  await delegateFor(resource).update({
    data: { deletedAt: null },
    where: { id },
  });
  await appendAudit(prisma, {
    action: 'admin.record_restored',
    actorId: actor.id,
    actorRole: actor.role,
    entity: DELETED_RESOURCES[resource].entity,
    entityId: id,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });
  return {
    createdAt: record.createdAt,
    deletedAt: record.deletedAt ?? record.createdAt,
    id: record.id,
    ...DELETED_RESOURCES[resource].toRow(record),
  };
};

export const purgeDeleted = async (
  resource: DeletedResource,
  id: string,
  actor: Actor,
  ctx: Ctx = {},
): Promise<void> => {
  const record = await requireDeleted(resource, id);
  await purgeRecord(DELETED_RESOURCES[resource].accessor, id);
  await appendAudit(prisma, {
    action: 'admin.record_purged',
    actorId: actor.id,
    actorRole: actor.role,
    entity: DELETED_RESOURCES[resource].entity,
    entityId: id,
    ipAddress: ctx.ipAddress ?? null,
    metadata: { label: DELETED_RESOURCES[resource].toRow(record).label },
    userAgent: ctx.userAgent ?? null,
  });
};
