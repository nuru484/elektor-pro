// src/jobs/notifications.queue.ts
//
// The queue behind every message this system sends to a voter.
//
// Fanning announcements out inline - one loop over the whole roll,
// `Promise.allSettled` per batch, failures counted and then discarded - does
// not survive an election-sized roll: on 2,800 voters a rate-limited SMS
// provider, a transient 502, or a restart mid-blast silently leaves some
// voters never told that voting had opened, with nothing to retry and
// nothing to inspect.
//
// One job per recipient fixes that: each message retries on its own schedule,
// a provider limit slows delivery instead of dropping it, and anything that
// exhausts its attempts stays on the failed set where it can be read and
// replayed.
import type { ConnectionOptions } from 'bullmq';

import { Queue } from 'bullmq';

import ENV from '../config/env.js';
import { createRedisConnection, queuesEnabled } from './connection.js';
import { registerQueue } from './lifecycle.js';
import { QUEUE_NAMES } from './queue-names.js';

export interface NotificationJob {
  /** Election this message belongs to, for auditing and tracing. */
  electionId?: string;
  email: null | string;
  /** Absolute URL the message points at, when it has somewhere to send them. */
  link?: string;
  /** Recipient's display name, used in the email body. */
  name: string;
  phoneNumber: null | string;
  /** Id of the request that queued the message, for log correlation. */
  requestId?: string;
  subject: string;
  text: string;
}

/**
 * Retry schedule. Five attempts with exponential backoff from 15s covers the
 * failures that actually happen here - a provider rate limit, a brief
 * upstream outage, a restart - across roughly four minutes, without hammering
 * a provider that is already refusing us.
 */
export const NOTIFICATION_ATTEMPTS = 5;
const BACKOFF_MS = 15_000;

let queue: null | Queue<NotificationJob> = null;

export const notificationQueue = (): null | Queue<NotificationJob> => {
  if (queue || !queuesEnabled()) return queue;
  const connection = createRedisConnection();
  if (!connection) return null;
  queue = registerQueue(
    new Queue<NotificationJob>(QUEUE_NAMES.NOTIFICATIONS, {
      connection: connection as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: NOTIFICATION_ATTEMPTS,
        backoff: { delay: BACKOFF_MS, type: 'exponential' },
        // Bounded history: enough to inspect a recent blast, not enough to
        // grow without limit on a busy election day.
        removeOnComplete: 1_000,
        // Failures are the ones worth keeping - a week is long enough to
        // notice a bad election night and replay what did not land.
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    }),
  );
  return queue;
};

/**
 * A stable job id per (election, voter, kind).
 *
 * BullMQ refuses a duplicate id while that job still exists, which makes a
 * re-run of an announcement idempotent. That matters more here than in most
 * systems: re-opening an election, or a worker restarting mid-fan-out, must
 * not text the whole roll a second time.
 */
export const notificationJobId = (
  kind: string,
  electionId: string,
  voterId: string,
): string => `${kind}:${electionId}:${voterId}`;

/** Worker tuning, so a deployment can match its providers' real limits. */
export const NOTIFICATION_CONCURRENCY = ENV.NOTIFICATION_CONCURRENCY;
export const NOTIFICATION_PER_SECOND = ENV.NOTIFICATION_PER_SECOND;
