// src/jobs/connection.ts
//
// Shared Redis connection factory for BullMQ queues and workers. Returns null
// when REDIS_URL is unset (local dev without Redis, CI, tests) so background
// queues become a deploy-time opt-in - callers must handle the disabled case
// by running without their queue rather than crashing at import time.
import { Redis } from 'ioredis';

import ENV from '../config/env.js';

/**
 * Create a BullMQ-compatible Redis connection. BullMQ requires
 * `maxRetriesPerRequest: null` (its blocking commands manage retries
 * themselves), and `enableReadyCheck: false` keeps startup fast on managed
 * Redis providers.
 */
export const createRedisConnection = (): null | Redis => {
  if (!ENV.REDIS_URL) return null;
  return new Redis(ENV.REDIS_URL, {
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  });
};

/** Whether background queues are enabled for this process. */
export const queuesEnabled = (): boolean => Boolean(ENV.REDIS_URL);
