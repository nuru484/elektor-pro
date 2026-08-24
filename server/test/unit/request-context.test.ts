import type { Request, Response } from 'express';

import { describe, expect, it } from 'vitest';

import { getRequestId } from '../../src/lib/request-store.js';
import { requestContext } from '../../src/middlewares/request-context.js';

const run = (next: () => void): void => {
  const req = { get: () => 'trace-abc-123' } as unknown as Request;
  const res = { setHeader: () => res } as unknown as Response;
  requestContext(req, res, next);
};

describe('request context store', () => {
  it('is empty outside a request', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('exposes the request id to async continuations of the request', async () => {
    let inHandler: string | undefined;
    let afterAwait: string | undefined;
    await new Promise<void>((resolve) => {
      run(() => {
        inHandler = getRequestId();
        void Promise.resolve().then(() => {
          afterAwait = getRequestId();
          resolve();
        });
      });
    });
    expect(inHandler).toBe('trace-abc-123');
    expect(afterAwait).toBe('trace-abc-123');
    expect(getRequestId()).toBeUndefined();
  });
});
