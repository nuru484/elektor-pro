// src/workers/mail.worker.ts
//
// Delivers one queued email. Import-for-side-effect from server.ts; disabled
// cleanly when REDIS_URL is unset, in which case the producer sends inline
// instead (see mail.queue.ts).
import type { ConnectionOptions } from 'bullmq';

import { Worker } from 'bullmq';

import { createRedisConnection, queuesEnabled } from '../jobs/connection.js';
import { registerWorker } from '../jobs/lifecycle.js';
import { type MailJob } from '../jobs/mail.queue.js';
import { QUEUE_NAMES } from '../jobs/queue-names.js';
import logger from '../utils/logger.js';
import sendMail from '../utils/sendMail.js';

/** Throwing is deliberate: it is what tells BullMQ to retry. */
export const deliverEmail = async (job: MailJob): Promise<void> => {
  await sendMail(job);
};

if (queuesEnabled()) {
  const connection = createRedisConnection();
  if (connection) {
    registerWorker(
      new Worker<MailJob>(
        QUEUE_NAMES.MAIL,
        async (job) => {
          await deliverEmail(job.data);
        },
        {
          concurrency: 5,
          connection: connection as unknown as ConnectionOptions,
          // The provider is the bottleneck, not us.
          limiter: { duration: 1_000, max: 10 },
        },
      ),
    );
    logger.info('Mail worker started');
  }
} else {
  logger.info('Mail worker disabled (REDIS_URL not set); email sends inline');
}
