// test/worker-count.ts
//
// The single source of truth for how many vitest workers run the suite.
// vitest.config.ts uses it as maxWorkers and global-setup.ts uses it to
// create/drop one database clone per worker - the two must agree or a worker
// would connect to a database that was never created.
import { availableParallelism } from 'node:os';

// Capped so worker connection pools stay well under Postgres max_connections
// (workers x DB_POOL_MAX, see vitest.config.ts) and one core stays free for
// Postgres itself.
export const TEST_WORKER_COUNT = Math.max(
  1,
  Math.min(7, availableParallelism() - 1),
);
