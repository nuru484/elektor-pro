// src/jobs/imports.queue.ts
//
// Queue for large voter/candidate imports. The rows themselves live in the
// ImportBatch row in Postgres and only the batch id travels through Redis -
// a 50,000-row payload has no business in a job argument, and keeping it in
// the database is what makes the work resumable across restarts.
import type { ConnectionOptions } from 'bullmq';

import { Queue } from 'bullmq';

import { createRedisConnection, queuesEnabled } from './connection.js';
import { registerQueue } from './lifecycle.js';
import { QUEUE_NAMES } from './queue-names.js';

export interface ImportJob {
  batchId: string;
}

/**
 * Three attempts, backing off from 30s. Import failures are usually the
 * database being briefly unavailable rather than the data being wrong - bad
 * rows are recorded per row and never fail the job - so a few widely spaced
 * retries are the right shape. Each retry resumes from the batch's cursor.
 */
export const IMPORT_ATTEMPTS = 3;

let queue: null | Queue<ImportJob> = null;

export const importQueue = (): null | Queue<ImportJob> => {
  if (queue || !queuesEnabled()) return queue;
  const connection = createRedisConnection();
  if (!connection) return null;
  queue = registerQueue(
    new Queue<ImportJob>(QUEUE_NAMES.IMPORTS, {
      connection: connection as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: IMPORT_ATTEMPTS,
        backoff: { delay: 30_000, type: 'exponential' },
        removeOnComplete: 100,
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    }),
  );
  return queue;
};
