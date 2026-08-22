// test/test-database-url.ts
//
// Where the suite's TEMPLATE database lives. Resolved once and shared by
// vitest.config.ts and test/global-setup.ts.
//
// No credentials are hardcoded here: a literal connection string would put a
// real local password into the repository and its history. Resolution order:
//   1. TEST_DATABASE_URL          - explicit, wins everywhere (CI, containers)
//   2. DATABASE_URL from .env     - the dev database, with its name swapped to
//                                   `<name>_test` so the suite can never point
//                                   at the database being developed against
//   3. a credential-free local default
//
// .env is PARSED, never loaded into process.env. Importing 'dotenv/config'
// here would inject the developer's whole environment into the suite, and the
// real SMTP/SMS credentials in it would turn the mocked mail and SMS channels
// into live network calls - which then run inside request transactions and
// blow their timeouts. vitest.config.ts owns the test environment; this file
// only borrows one value from .env.
import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DB_NAME = 'elektor_pro_test';

/** Swap the database name in a connection URL, keeping host/auth/params. */
const withDatabase = (connectionString: string, database: string): string => {
  const url = new URL(connectionString);
  url.pathname = `/${database}`;
  return url.toString();
};

/** DATABASE_URL from the environment, or parsed out of .env without loading it. */
const devDatabaseUrl = (): string | undefined => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
    return parse(readFileSync(envPath)).DATABASE_URL;
  } catch {
    return undefined; // no .env (CI); the caller falls through to the default
  }
};

const fromDevDatabase = (): string | undefined => {
  const devUrl = devDatabaseUrl();
  if (!devUrl) return undefined;
  try {
    return withDatabase(devUrl, TEST_DB_NAME);
  } catch {
    return undefined;
  }
};

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  fromDevDatabase() ??
  `postgresql://postgres@localhost:5432/${TEST_DB_NAME}`;
