// src/lib/prisma.ts
// Single shared Prisma client for the whole app. Imported everywhere — never `new PrismaClient()`.
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import ENV from '../config/env.js';

const adapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });

/**
 * Models that carry a `deletedAt` column and participate in soft deletes.
 * Keys are the camelCase Prisma model accessors.
 */
const SOFT_DELETE_MODELS = new Set<string>([
  'agentAssignment',
  'candidate',
  'college',
  'department',
  'election',
  'hall',
  'portfolio',
  'programme',
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
 * `findUnique` is intentionally NOT filtered — it is the deliberate seam for
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

const createPrismaClient = () => withSoftDelete(new PrismaClient({ adapter }));

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedPrismaClient;
};

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (ENV.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
export * from '../../generated/prisma/client.js';
