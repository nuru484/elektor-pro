// src/workers/notification.worker.ts
//
// Delivers one queued message per voter. Import-for-side-effect from
// server.ts; disabled cleanly when REDIS_URL is unset, in which case
// announcements fall back to inline delivery (see
// election-announcements.service.ts) so the system still works without Redis -
// it just loses the retries.
import type { ConnectionOptions } from 'bullmq';

import { Worker } from 'bullmq';

import { createRedisConnection, queuesEnabled } from '../jobs/connection.js';
import { registerWorker } from '../jobs/lifecycle.js';
import {
  NOTIFICATION_CONCURRENCY,
  NOTIFICATION_PER_SECOND,
  type NotificationJob,
} from '../jobs/notifications.queue.js';
import { QUEUE_NAMES } from '../jobs/queue-names.js';
import { defaultDeps } from '../services/deps.js';
import logger from '../utils/logger.js';

/**
 * Send one message. SMS is preferred, email is the fallback - the same rule
 * the inline path applies, so both routes behave identically.
 *
 * Throwing is deliberate: it is what tells BullMQ to retry. A recipient with
 * neither channel is NOT an error - nothing can be done for them, and
 * retrying would burn attempts on an outcome that cannot change.
 */
export const deliverNotification = async (
  job: NotificationJob,
  deps = defaultDeps,
): Promise<'email' | 'none' | 'sms'> => {
  if (job.phoneNumber) {
    await deps.sms.send(job.phoneNumber, job.text);
    return 'sms';
  }
  if (job.email) {
    await deps.mail.send({
      email: job.email,
      subject: job.subject,
      text: `Hello ${job.name},\n\n${job.text}`,
    });
    return 'email';
  }
  return 'none';
};

if (queuesEnabled()) {
  const connection = createRedisConnection();
  if (connection) {
    registerWorker(
      new Worker<NotificationJob>(
        QUEUE_NAMES.NOTIFICATIONS,
        async (job) => deliverNotification(job.data),
        {
          concurrency: NOTIFICATION_CONCURRENCY,
          connection: connection as unknown as ConnectionOptions,
          // The provider is the bottleneck, not us. Without a limiter a
          // 2,800-voter blast opens as many parallel requests as concurrency
          // allows and trips the SMS gateway's own rate limit, turning
          // deliverable messages into retries.
          limiter: { duration: 1_000, max: NOTIFICATION_PER_SECOND },
        },
      ),
    );
    logger.info(
      { concurrency: NOTIFICATION_CONCURRENCY, perSecond: NOTIFICATION_PER_SECOND },
      'Notification worker started',
    );
  }
} else {
  logger.info('Notification worker disabled (REDIS_URL not set); announcements deliver inline');
}
