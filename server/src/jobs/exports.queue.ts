// src/jobs/exports.queue.ts
//
// Queue for background results exports. Only the job id travels through
// Redis; the file lands on disk and the ExportJob row is the handle.
import type { ConnectionOptions } from 'bullmq';

import { Queue } from 'bullmq';

import { createRedisConnection, queuesEnabled } from './connection.js';
import { registerQueue } from './lifecycle.js';
import { QUEUE_NAMES } from './queue-names.js';

export interface ExportJobData {
  exportJobId: string;
}

/**
 * Three attempts backing off from 20s. An export fails because the database
 * was briefly unreachable or the disk was full, both worth one or two
 * retries; rendering the same results twice is harmless because the job is
 * idempotent once READY.
 */
export const EXPORT_ATTEMPTS = 3;

let queue: null | Queue<ExportJobData> = null;

export const exportQueue = (): null | Queue<ExportJobData> => {
  if (queue || !queuesEnabled()) return queue;
  const connection = createRedisConnection();
  if (!connection) return null;
  queue = registerQueue(
    new Queue<ExportJobData>(QUEUE_NAMES.EXPORTS, {
      connection: connection as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: EXPORT_ATTEMPTS,
        backoff: { delay: 20_000, type: 'exponential' },
        removeOnComplete: 100,
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    }),
  );
  return queue;
};
