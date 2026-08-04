// test/setup-worker-db.ts
//
// MUST be the first (and only DB-related) entry in setupFiles. Rewrites
// DATABASE_URL to this worker's private clone of the template database
// BEFORE any application module is imported: src/config/env.ts and
// src/lib/prisma.ts both read process.env at import time, and ES imports
// hoist, so this file deliberately imports nothing from the app and does its
// work at the top level.
//
// VITEST_POOL_ID is stable per worker slot (1..maxWorkers), so at most
// TEST_WORKER_COUNT databases are ever addressed; global-setup.ts creates
// exactly that many and drops them again in teardown.
const poolId = process.env.VITEST_POOL_ID ?? '1';

process.env.DATABASE_URL = (process.env.DATABASE_URL ?? '').replace(
  /\/elektor_pro_test(\?|$)/,
  `/elektor_pro_test_w${poolId}$1`,
);
