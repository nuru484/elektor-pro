import { defineConfig } from 'vitest/config';

import { TEST_WORKER_COUNT } from './test/worker-count.js';

// Single source of truth for the TEMPLATE test DB shared with
// test/global-setup.ts; override with TEST_DATABASE_URL to run the suite
// elsewhere (CI, containers). Each worker runs against its own clone
// (elektor_pro_test_wN) - see test/setup-worker-db.ts.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://nuru:0553997465@localhost:5432/elektor_pro_test';

export default defineConfig({
  test: {
    env: {
      ACCESS_TOKEN_SECRET: 'test_access_secret_0123456789abcdef0123456789abcdef',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'test',
      CLOUDINARY_CLOUD_NAME: 'test',
      COOKIE_DOMAIN: '',
      CORS_ACCESS: 'http://localhost:3000',
      // The TEMPLATE database. test/setup-worker-db.ts rewrites this inside
      // each worker to that worker's private clone (elektor_pro_test_wN)
      // before any app module reads it.
      DATABASE_URL: TEST_DATABASE_URL,
      // Per-worker Prisma pool cap: TEST_WORKER_COUNT workers x 5
      // connections stays far below Postgres's default max_connections of
      // 100. The prod default of 20 would not.
      DB_POOL_MAX: '5',
      NODE_ENV: 'test',
      OTP_MODE: 'mock',
      // The rate-limit tests assert exact request counts: pin the dev
      // relaxation multiplier to the real (production) limits.
      RATE_LIMIT_SCALE: '1',
      // Tests must never share rate-limit counters with a running dev
      // server's Redis - keep the in-memory store.
      REDIS_URL: '',
      REFRESH_TOKEN_SECRET: 'test_refresh_secret_fedcba9876543210fedcba9876543210',
    },
    globals: true,
    globalSetup: './test/global-setup.ts',
    hookTimeout: 30_000,
    include: ['test/**/*.test.ts'],
    // Test files run in parallel, each worker against its own clone of the
    // template database. The per-test TRUNCATE (helpers.resetDb) only ever
    // touches the worker's own clone, so files never contend.
    maxWorkers: TEST_WORKER_COUNT,
    pool: 'forks',
    // Rewrites DATABASE_URL before anything imports the Prisma client.
    setupFiles: ['./test/setup-worker-db.ts'],
    testTimeout: 20_000,
  },
});
