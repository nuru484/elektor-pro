// src/lib/prisma.ts
// Single shared Prisma client for the whole app. Imported everywhere - never `new PrismaClient()`.
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import ENV from '../config/env.js';

// Explicit pool cap (pg defaults to 10). The API and the in-process BullMQ
// workers share this one pool, so the cap must exceed the workers' combined
// fan-out or a busy job queues every API request behind it.
const adapter = new PrismaPg({ connectionString: ENV.DATABASE_URL, max: ENV.DB_POOL_MAX });

/**
 * Models that carry a `deletedAt` column and participate in soft deletes.
 * Keys are the camelCase Prisma model accessors. Must stay in sync with
 * `deletedAt` fields in schema.prisma.
 */
const SOFT_DELETE_MODELS = new Set<string>([
  'accreditorAssignment',
  'agentAssignment',
  'candidate',
  'election',
  'group',
  'groupCategory',
  'portfolio',
  'user',
  'voter',
]);

const READ_OPERATIONS = new Set<string>([
  'aggregate',
  'count',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'groupBy',
]);

export type SoftDeleteModelAccessor =
  | 'agentAssignment'
  | 'candidate'
  | 'election'
  | 'group'
  | 'groupCategory'
  | 'portfolio'
  | 'user'
  | 'voter';

interface SoftDeletableDelegate {
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
}

/**
 * Soft-delete extension.
 *
 * - `delete` / `deleteMany` are rewritten to set `deletedAt`.
 * - read operations default to excluding soft-deleted rows (pass `deletedAt`
 *   explicitly to include them).
 *
 * `findUnique` is intentionally NOT filtered - it is the deliberate seam for
 * looking a record up regardless of soft-delete state. Use `findFirst` for a
 * soft-delete-aware lookup.
 */
function withSoftDelete(base: PrismaClient) {
  const delegates = base as unknown as Record<string, SoftDeletableDelegate>;

  return base.$extends({
    name: 'soft-delete',
    query: {
      $allModels: {
        $allOperations({ args, model, operation, query }) {
          const accessor = model.charAt(0).toLowerCase() + model.slice(1);
          if (!SOFT_DELETE_MODELS.has(accessor)) {
            return query(args);
          }

          const typedArgs = args as { where?: Record<string, unknown> };

          if (operation === 'delete') {
            return delegates[accessor].update({
              data: { deletedAt: new Date() },
              where: typedArgs.where,
            });
          }

          if (operation === 'deleteMany') {
            return delegates[accessor].updateMany({
              data: { deletedAt: new Date() },
              where: typedArgs.where ?? {},
            });
          }

          if (READ_OPERATIONS.has(operation)) {
            typedArgs.where = { deletedAt: null, ...typedArgs.where };
          }

          return query(args);
        },
      },
    },
  });
}

const createClients = () => {
  const base = new PrismaClient({ adapter });
  return { base, extended: withSoftDelete(base) };
};

type Clients = ReturnType<typeof createClients>;

const globalForPrisma = globalThis as unknown as {
  prismaClients?: Clients;
};

const clients = globalForPrisma.prismaClients ?? createClients();

if (ENV.NODE_ENV !== 'production') globalForPrisma.prismaClients = clients;

const prisma = clients.extended;

/**
 * The ONLY sanctioned hard-delete path. The soft-delete extension rewrites
 * `delete` to an update, so the deleted-records purge goes through the base
 * (unextended) client - same instance, same pool. Callers must verify the
 * row is already soft-deleted before purging.
 */
export const purgeRecord = (
  accessor: SoftDeleteModelAccessor,
  id: string,
): Promise<unknown> => {
  const delegates = clients.base as unknown as Record<
    SoftDeleteModelAccessor,
    { delete: (args: { where: { id: string } }) => Promise<unknown> }
  >;
  return delegates[accessor].delete({ where: { id } });
};

export default prisma;
export * from '../../generated/prisma/client.js';
