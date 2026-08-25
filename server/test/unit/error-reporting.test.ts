import type { ErrorEvent } from '@sentry/node';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
  init: vi.fn(),
  withScope: vi.fn(),
}));

vi.mock('../../src/config/env.js', () => ({
  default: {
    NODE_ENV: 'test',
    SENTRY_DSN: 'https://key@o0.ingest.sentry.io/1',
    SENTRY_ENVIRONMENT: 'staging',
    SENTRY_RELEASE: 'abc123',
    SENTRY_TRACES_SAMPLE_RATE: 0.25,
  },
}));

import * as Sentry from '@sentry/node';

import ENV from '../../src/config/env.js';
import {
  _resetErrorReportingForTests,
  flushErrorReporting,
  initErrorReporting,
  reportError,
  scrubEvent,
} from '../../src/lib/error-reporting.js';
import { requestStore } from '../../src/lib/request-store.js';

const DSN = 'https://key@o0.ingest.sentry.io/1';

interface Scope {
  setContext: ReturnType<typeof vi.fn>;
  setLevel: ReturnType<typeof vi.fn>;
  setTag: ReturnType<typeof vi.fn>;
  setUser: ReturnType<typeof vi.fn>;
}

const captureScope = (): Scope => {
  const scope: Scope = {
    setContext: vi.fn(),
    setLevel: vi.fn(),
    setTag: vi.fn(),
    setUser: vi.fn(),
  };
  vi.mocked(Sentry.withScope).mockImplementation(((fn: (s: Scope) => void) => {
    fn(scope);
  }) as unknown as typeof Sentry.withScope);
  return scope;
};

describe('error reporting init', () => {
  beforeEach(() => {
    _resetErrorReportingForTests();
    vi.clearAllMocks();
    ENV.SENTRY_DSN = DSN;
  });

  it('passes environment, release and sample rate to Sentry.init', () => {
    initErrorReporting();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'staging',
        release: 'abc123',
        sendDefaultPii: false,
        tracesSampleRate: 0.25,
      }),
    );
  });

  it('installs beforeSend as the scrubber', () => {
    initErrorReporting();
    const options = vi.mocked(Sentry.init).mock.calls[0][0]!;
    const event = { message: 'password=hunter2' } as ErrorEvent;
    expect(options.beforeSend!(event, {})).toEqual({ message: 'password=[REDACTED]' });
  });

  it('initializes once and flushes with the given timeout', async () => {
    initErrorReporting();
    initErrorReporting();
    expect(Sentry.init).toHaveBeenCalledOnce();
    await flushErrorReporting(2000);
    expect(Sentry.flush).toHaveBeenCalledWith(2000);
  });

  it('stays disabled without a DSN: no init, no capture, no flush', async () => {
    ENV.SENTRY_DSN = '';
    initErrorReporting();
    reportError(new Error('boom'), { errorId: 'e1', severity: 'high' });
    await flushErrorReporting();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.flush).not.toHaveBeenCalled();
  });
});

describe('reportError user attribution', () => {
  beforeEach(() => {
    _resetErrorReportingForTests();
    vi.clearAllMocks();
    ENV.SENTRY_DSN = DSN;
    initErrorReporting();
  });

  it('sets the principal id, and nothing else, inside an authenticated request', () => {
    const scope = captureScope();
    requestStore.run({ requestId: 'req-1', userId: 'user-42' }, () => {
      reportError(new Error('boom'), { errorId: 'e1', requestId: 'req-1', severity: 'high' });
    });
    expect(scope.setUser).toHaveBeenCalledWith({ id: 'user-42' });
    expect(scope.setTag).toHaveBeenCalledWith('requestId', 'req-1');
  });

  it('clears the user outside an authenticated request', () => {
    const scope = captureScope();
    requestStore.run({ requestId: 'req-2' }, () => {
      reportError(new Error('boom'), { errorId: 'e2', severity: 'high' });
    });
    reportError(new Error('boom'), { errorId: 'e3', severity: 'critical' });
    expect(scope.setUser).toHaveBeenCalledTimes(2);
    expect(scope.setUser).toHaveBeenNthCalledWith(1, null);
    expect(scope.setUser).toHaveBeenNthCalledWith(2, null);
    expect(scope.setLevel).toHaveBeenLastCalledWith('fatal');
  });
});

describe('scrubEvent', () => {
  it('masks sensitive values in extra and contexts, keeping the keys', () => {
    const event = scrubEvent({
      contexts: { details: { body: { email: 'a@b.com', password: 'p' }, query: { token: 't' } } },
      extra: { apiKey: 'k', nested: { otp: '123456', safe: 1 } },
    } as unknown as ErrorEvent);
    expect(event.extra).toEqual({ apiKey: '[REDACTED]', nested: { otp: '[REDACTED]', safe: 1 } });
    expect(event.contexts).toEqual({
      details: { body: { email: 'a@b.com', password: '[REDACTED]' }, query: { token: '[REDACTED]' } },
    });
  });

  it('masks request headers, cookies, query string and body', () => {
    const event = scrubEvent({
      request: {
        cookies: { accessToken: 'jwt', theme: 'dark' },
        data: { code: '000111', voter: 'v1' },
        headers: { authorization: 'Bearer x', host: 'api' },
        method: 'POST',
        query_string: 'token=abc&page=2',
        url: '/auth/login',
      },
    } as unknown as ErrorEvent);
    expect(event.request).toEqual({
      cookies: { accessToken: '[REDACTED]', theme: '[REDACTED]' },
      data: { code: '[REDACTED]', voter: 'v1' },
      headers: { authorization: '[REDACTED]', host: 'api' },
      method: 'POST',
      query_string: 'token=[REDACTED]&page=2',
      url: '/auth/login',
    });
  });

  it('masks key=value fragments quoted in messages and exception values', () => {
    const event = scrubEvent({
      exception: { values: [{ type: 'Error', value: 'rejected: {"refreshToken":"abc.def", "id":"u1"}' }] },
      message: 'login failed for otp: 123456 secret=s3cr3t',
    } as unknown as ErrorEvent);
    expect(event.message).toBe('login failed for otp: [REDACTED] secret=[REDACTED]');
    expect(event.exception?.values?.[0].value).toBe('rejected: {"refreshToken":"[REDACTED]", "id":"u1"}');
  });

  it('leaves an event with nothing sensitive untouched', () => {
    const event = { message: 'plain failure', tags: { layer: 'worker' } } as unknown as ErrorEvent;
    expect(scrubEvent(event)).toEqual({ message: 'plain failure', tags: { layer: 'worker' } });
  });
});
