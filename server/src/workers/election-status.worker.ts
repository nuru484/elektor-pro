// src/workers/election-status.worker.ts
//
// The election lifecycle scheduler: a repeatable BullMQ job sweeps election
// statuses every minute (auto open at startDate, auto close at endDate).
// Import-for-side-effect from server.ts; silently disabled when REDIS_URL is
// unset (local dev without Redis) - the sweep can still be run manually via
// the service.
import { Queue, Worker } from 'bullmq';

import { createRedisConnection, queuesEnabled } from '../jobs/connection.js';
import { registerQueue, registerWorker } from '../jobs/lifecycle.js';
import { QUEUE_NAMES } from '../jobs/queue-names.js';
import { sweepElectionStatuses } from '../services/domain/election-scheduler.service.js';
import logger from '../utils/logger.js';

if (queuesEnabled()) {
  const queueConnection = createRedisConnection();
  const workerConnection = createRedisConnection();
  if (queueConnection && workerConnection) {
    const queue = registerQueue(
      new Queue(QUEUE_NAMES.ELECTION_STATUS, {
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
      'election-status-sweep',
      { every: 60_000 },
      { name: 'sweep' },
    );

    registerWorker(
      new Worker(
        QUEUE_NAMES.ELECTION_STATUS,
        async () => {
          const result = await sweepElectionStatuses();
          if (result.opened > 0 || result.closed > 0) {
            logger.info(result, 'Election status sweep applied transitions');
          }
          return result;
        },
        { connection: workerConnection },
      ),
    );
    logger.info('Election status scheduler started (sweep every 60s)');
  }
} else {
  logger.info('Election status scheduler disabled (REDIS_URL not set)');
}
