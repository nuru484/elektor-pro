// src/lib/outbox.ts
//
// Post-commit side effects.
//
// Sending an email or an SMS from inside a database transaction is a trap:
// the network call sits on the transaction's critical path, so a slow relay
// spends the transaction's whole budget and the write fails. Bulk candidate
// import is the sharp edge: a real SMTP server costs ~3s per credential mail,
// so two nominations blow Prisma's 5s transaction timeout and the import
// fails with a database error that says nothing about email.
//
// Deferring the send also fixes the ordering: credentials should never go out
// for a nomination whose transaction then rolls back.
//
// Usage:
//   withOutbox(() => prisma.$transaction(async (tx) => {
//     ...writes...
//     afterCommit(() => mail.send(...));   // queued, not awaited
//   }))
//
// Tasks run once the wrapped work resolves, in order, and are best-effort:
// a failed notification is logged, never propagated, because the committed
// write is the thing that mattered.
import { AsyncLocalStorage } from 'node:async_hooks';

import logger from '../utils/logger.js';

type OutboxTask = () => Promise<unknown>;

const storage = new AsyncLocalStorage<OutboxTask[]>();

/**
 * Run `fn` with an outbox in scope, then flush whatever it queued. Rejections
 * from `fn` propagate untouched and the outbox is DISCARDED - that is the
 * point: a rolled-back transaction sends nothing.
 */
export const withOutbox = async <T>(fn: () => Promise<T>): Promise<T> => {
  const tasks: OutboxTask[] = [];
  const result = await storage.run(tasks, fn);

  for (const task of tasks) {
    try {
      await task();
    } catch (error) {
      logger.warn({ error }, 'Post-commit task failed');
    }
  }
  return result;
};

/**
 * Queue work to run after the surrounding transaction commits. With no outbox
 * in scope the task runs immediately (still best-effort), so callers outside a
 * transaction need no special handling.
 */
export const afterCommit = (task: OutboxTask): void => {
  const tasks = storage.getStore();
  if (tasks) {
    tasks.push(task);
    return;
  }
  void task().catch((error: unknown) => {
    logger.warn({ error }, 'Deferred task failed');
  });
};
