// src/lib/request-store.ts
//
// Async-local request context, so code with no `req` in scope (a service
// enqueuing a job) can still stamp the originating request id on its work.
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestStore {
  requestId: string;
}

export const requestStore = new AsyncLocalStorage<RequestStore>();

/** The id of the request whose async continuation is running; undefined outside one. */
export const getRequestId = (): string | undefined =>
  requestStore.getStore()?.requestId;
