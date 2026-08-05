// test/global-setup.ts
//
// Runs once before the whole suite (in the main process, not a worker).
//
// Parallel-suite database layout:
//   elektor_pro_test     - the TEMPLATE: created if missing, migrated to the
//                          current schema, never written to by tests.
//   elektor_pro_test_wN  - one private clone per vitest worker (N = pool id,
//                          1..TEST_WORKER_COUNT), created here with
//                          CREATE DATABASE ... TEMPLATE (a fast file-level
//                          copy, no per-clone migrate) and DROPPED again in
//                          teardown so test databases never pile up.
//
// Workers pick their clone in test/setup-worker-db.ts via VITEST_POOL_ID.
import { execSync } from 'node:child_process';
import pg from 'pg';

import { TEST_DATABASE_URL } from './test-database-url.js';
import { TEST_WORKER_COUNT } from './worker-count.js';

export { TEST_DATABASE_URL };

const url = new URL(TEST_DATABASE_URL);
const TEST_DB_NAME = url.pathname.slice(1).replaceAll('"', '');

const adminUrl = new URL(TEST_DATABASE_URL);
adminUrl.pathname = '/postgres';

const workerDbNames = Array.from(
  { length: TEST_WORKER_COUNT },
  (_, i) => `${TEST_DB_NAME}_w${String(i + 1)}`,
);

const withMaintenanceClient = async (
  fn: (client: pg.Client) => Promise<void>,
): Promise<void> => {
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    await fn(client);
  } finally {
    await client.end();
  }
};

export async function setup(): Promise<void> {
  await withMaintenanceClient(async (client) => {
    const exists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );
    if (exists.rowCount === 0) {
      // Identifier, not a value - cannot be parameterized. The name comes
      // from our own config, not user input.
      await client.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  });

  // Migrate the TEMPLATE. `migrate deploy` is idempotent, so this is cheap
  // when the schema hasn't changed.
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'ignore',
  });

  await withMaintenanceClient(async (client) => {
    // CREATE DATABASE ... TEMPLATE refuses while anything is connected to
    // the template; a crashed previous run can leave such a connection.
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [TEST_DB_NAME],
    );
    // Clones are recreated from scratch every run so one can never carry a
    // stale schema from an earlier checkout.
    for (const name of workerDbNames) {
      await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await client.query(`CREATE DATABASE "${name}" TEMPLATE "${TEST_DB_NAME}"`);
    }
  });
}

// Drops the per-worker clones after the run. The template stays: it holds no
// data, and keeping it makes the next run's migrate deploy a no-op.
export async function teardown(): Promise<void> {
  await withMaintenanceClient(async (client) => {
    for (const name of workerDbNames) {
      await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    }
  });
}
