// src/workers/auth-maintenance.worker.ts
//
// Hourly BullMQ sweep purging expired/consumed OTPs, password-reset tokens,
// and long-dead sessions (see auth-maintenance.service.ts for the retention
// rules). Import-for-side-effect from server.ts; silently disabled when
// REDIS_URL is unset - the sweep can still be run directly via the service.
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, queuesEnabled } from '../jobs/connection.js';
import { registerQueue, registerWorker } from '../jobs/lifecycle.js';
import { QUEUE_NAMES } from '../jobs/queue-names.js';
import { sweepExpiredAuthRecords } from '../services/auth/auth-maintenance.service.js';
import { sweepExpiredExports } from '../services/results/export-job.service.js';
import logger from '../utils/logger.js';

if (queuesEnabled()) {
  const queueConnection = createRedisConnection();
  const workerConnection = createRedisConnection();
  if (queueConnection && workerConnection) {
    const queue = registerQueue(
      new Queue(QUEUE_NAMES.AUTH_MAINTENANCE, {
        connection: queueConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { delay: 5000, type: 'exponential' },
          removeOnComplete: 20,
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        },
      }),
    );

    // Idempotent per boot; replaces a stale cadence if the interval changes.
    void queue.upsertJobScheduler(
      'auth-maintenance-sweep',
      { every: 60 * 60 * 1000 },
      { name: 'sweep' },
    );

    registerWorker(
      new Worker(
        QUEUE_NAMES.AUTH_MAINTENANCE,
        async () => {
          const result = await sweepExpiredAuthRecords();
          // Generated exports ride the same hourly sweep rather than earning
          // their own schedule: results are the most sensitive artefact this
          // system writes to disk, and leaving them there indefinitely is the
          // risk worth closing.
          const exports = await sweepExpiredExports();
          if (
            result.otps > 0 ||
            result.resetTokens > 0 ||
            result.sessions > 0 ||
            exports.removed > 0
          ) {
            logger.info(
              { ...result, exportsRemoved: exports.removed },
              'Maintenance sweep purged expired records',
            );
          }
          return { ...result, exportsRemoved: exports.removed };
        },
        { connection: workerConnection },
      ),
    );
    logger.info('Auth maintenance sweep started (hourly)');
  }
} else {
  logger.info('Auth maintenance sweep disabled (REDIS_URL not set)');
}
