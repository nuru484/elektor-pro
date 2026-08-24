// src/jobs/mail.queue.ts
//
// The queue for email that must not fail the action that triggered it, and
// must not be lost either: account credentials and account-security notices.
//
// Sending those inline was the old shape, and it was wrong in both
// directions - a temporary password went out unawaited with no retry, so one
// refused API call silently stranded a new user with no way in but a password
// reset. Queued, the same failure costs a few seconds and lands in the inbox
// on the next attempt; a send that exhausts its attempts stays on the failed
// set where it can be read and replayed.
//
// Mail a person is WAITING for - a sign-in code, a reset link, a ballot code -
// does not belong here. Those stay awaited at the call site so a failure can
// reach the person still looking at the screen.
import type { ConnectionOptions } from 'bullmq';

import { Queue } from 'bullmq';

import type { EmailOptions } from '../utils/sendMail.js';

import { getRequestId } from '../lib/request-store.js';
import logger from '../utils/logger.js';
import sendMail from '../utils/sendMail.js';
import { createRedisConnection, queuesEnabled } from './connection.js';
import { registerQueue } from './lifecycle.js';
import { QUEUE_NAMES } from './queue-names.js';

export type MailJob = EmailOptions & {
  /** Id of the request that queued the mail, for log correlation. */
  requestId?: string;
};

/**
 * Five attempts with exponential backoff from 15s: the failures that actually
 * happen here are a provider rate limit, a brief outage, a restart. Roughly
 * four minutes of patience, without hammering a provider already refusing us.
 */
export const MAIL_ATTEMPTS = 5;
const BACKOFF_MS = 15_000;

let queue: null | Queue<MailJob> = null;

export const mailQueue = (): null | Queue<MailJob> => {
  if (queue || !queuesEnabled()) return queue;
  const connection = createRedisConnection();
  if (!connection) return null;
  queue = registerQueue(
    new Queue<MailJob>(QUEUE_NAMES.MAIL, {
      connection: connection as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: MAIL_ATTEMPTS,
        backoff: { delay: BACKOFF_MS, type: 'exponential' },
        removeOnComplete: 1_000,
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    }),
  );
  return queue;
};

/**
 * Hands an email to the queue. Never throws: the caller has already done the
 * thing the email is about.
 *
 * Without Redis (development, CI, a deployment that runs without it) there is
 * no queue to hand it to, so the message is sent inline instead - the same
 * degradation the announcement fan-out makes. That costs the retries, not the
 * email.
 */
export const enqueueEmail = async (options: MailJob): Promise<void> => {
  const q = mailQueue();
  try {
    if (q) {
      await q.add('send-email', { ...options, requestId: getRequestId() });
      return;
    }
    await sendMail(options);
  } catch (error) {
    logger.error(
      { error, subject: options.subject },
      'Email could not be queued or sent',
    );
  }
};
