// src/lib/request-store.ts
//
// Async-local request context, so code with no `req` in scope (a service
// enqueuing a job, the error tracker) can still stamp the originating request
// id and principal on its work. Workers re-enter the store with the id a job
// was enqueued under, so a job's log lines link back to the request.
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestStore {
  requestId: string;
  /** Opaque id of the authenticated principal; unset until authentication ran. */
  userId?: string;
}

export const requestStore = new AsyncLocalStorage<RequestStore>();

/** The id of the request whose async continuation is running; undefined outside one. */
export const getRequestId = (): string | undefined =>
  requestStore.getStore()?.requestId;

/** The authenticated principal's id for the running request; undefined when anonymous. */
export const getRequestUserId = (): string | undefined =>
  requestStore.getStore()?.userId;

/** Records the authenticated principal on the running request; no-op outside one. */
export const setRequestUserId = (userId: string): void => {
  const store = requestStore.getStore();
  if (store) store.userId = userId;
};

/**
 * Run `fn` inside the context of the request that enqueued a job. Without a
 * requestId (a scheduled sweep) the job runs as it would anyway.
 */
export const runWithRequestId = <T>(requestId: string | undefined, fn: () => T): T =>
  requestId ? requestStore.run({ requestId }, fn) : fn();
