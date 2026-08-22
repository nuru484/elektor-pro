// src/jobs/queue-names.ts
//
// Single source of truth for BullMQ queue names. Producers (queues) and
// consumers (workers) both import from here so a name can never drift between
// the two sides.
export const QUEUE_NAMES = {
  AUTH_MAINTENANCE: 'auth-maintenance',
  ELECTION_STATUS: 'election-status',
  EXPORTS: 'exports',
  IMPORTS: 'imports',
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
