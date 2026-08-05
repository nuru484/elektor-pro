// src/lib/credential-pool.ts
//
// Pre-hashed temporary passwords for accounts minted inside a transaction.
//
// bcrypt is deliberately slow - that is the entire point of it - at roughly
// 300-500ms per hash at cost 12. Hashing inside a transaction puts that cost
// on the transaction's critical path, and the cost scales with the number of
// accounts being created: a bulk import of 20 nominations spent more than
// Prisma's 5s transaction budget hashing alone and failed the whole import
// with a database error that said nothing about passwords. The candidate
// import schema allows up to 1000 rows, so this was not a corner case.
//
// The pool is therefore filled BEFORE the transaction opens and drained
// inside it. Applier signatures stay unchanged: the pool travels through
// AsyncLocalStorage, the same way the post-commit outbox does.
import { AsyncLocalStorage } from 'node:async_hooks';

import { hashPassword } from '../utils/password.js';
import { generateTempPassword } from '../utils/temp-password.js';

export interface Credential {
  /** bcrypt hash, ready to store. */
  hash: string;
  /** Plaintext, to be delivered to the account holder once. */
  password: string;
}

const storage = new AsyncLocalStorage<Credential[]>();

/**
 * Hashing is CPU-bound and runs on libuv's threadpool (4 by default), so an
 * unbounded fan-out neither goes faster nor stays polite to the rest of the
 * process. Batch it.
 */
const HASH_CONCURRENCY = 4;

const mintCredential = async (): Promise<Credential> => {
  const password = generateTempPassword();
  return { hash: await hashPassword(password), password };
};

/**
 * Fill a pool of `count` credentials, then run `fn` with it in scope.
 * A count of zero costs nothing, so this is safe to wrap unconditionally.
 */
export const withCredentialPool = async <T>(
  count: number,
  fn: () => Promise<T>,
): Promise<T> => {
  const pool: Credential[] = [];
  for (let i = 0; i < count; i += HASH_CONCURRENCY) {
    const batch = Math.min(HASH_CONCURRENCY, count - i);
    pool.push(...(await Promise.all(Array.from({ length: batch }, mintCredential))));
  }
  return storage.run(pool, fn);
};

/**
 * Take a pre-hashed credential. Falls back to hashing on the spot when no
 * pool is in scope (a single create outside the prepared path), so callers
 * never have to care which situation they are in.
 */
export const takeCredential = async (): Promise<Credential> =>
  storage.getStore()?.shift() ?? (await mintCredential());
