// test/global-setup.ts — create the test database and apply migrations once.
//
// The test DB URL comes from TEST_DATABASE_URL when set (CI, another machine),
// falling back to the local dev default. The database is created through the
// `pg` driver against the server's maintenance DB, so the suite needs no psql
// binary on PATH.
import { execSync } from 'node:child_process';
import pg from 'pg';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://nuru:0553997465@localhost:5432/elektor_pro_test';

export default async function setup(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const exists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (exists.rowCount === 0) {
      // Identifier, not a value - cannot be parameterized. dbName comes from
      // our own config, not user input.
      await client.query(`CREATE DATABASE "${dbName.replaceAll('"', '')}"`);
    }
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'ignore',
  });
}
