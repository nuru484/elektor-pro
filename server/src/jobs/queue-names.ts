// src/jobs/queue-names.ts
//
// Single source of truth for BullMQ queue names. Producers (queues) and
// consumers (workers) both import from here so a name can never drift between
// the two sides. Names are added as each feature's queue lands.
export const QUEUE_NAMES = {
  ELECTION_STATUS: 'election-status',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
