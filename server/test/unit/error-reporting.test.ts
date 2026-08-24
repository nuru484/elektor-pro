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
    SENTRY_TRACES_SAMPLE_RATE: 0.25,
  },
}));

import * as Sentry from '@sentry/node';

import {
  _resetErrorReportingForTests,
  flushErrorReporting,
  initErrorReporting,
} from '../../src/lib/error-reporting.js';

describe('error reporting init', () => {
  beforeEach(() => {
    _resetErrorReportingForTests();
    vi.clearAllMocks();
  });

  it('passes SENTRY_ENVIRONMENT and SENTRY_TRACES_SAMPLE_RATE to Sentry.init', () => {
    initErrorReporting();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'staging', tracesSampleRate: 0.25 }),
    );
  });

  it('initializes once and flushes with the given timeout', async () => {
    initErrorReporting();
    initErrorReporting();
    expect(Sentry.init).toHaveBeenCalledOnce();
    await flushErrorReporting(2000);
    expect(Sentry.flush).toHaveBeenCalledWith(2000);
  });
});
