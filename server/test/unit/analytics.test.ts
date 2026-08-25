import { beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  on: vi.fn(),
  shutdown: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(function PostHogMock() {
    return posthog;
  }),
}));

vi.mock('../../src/config/env.js', () => ({
  default: {
    NODE_ENV: 'test',
    POSTHOG_API_KEY: 'phc_test',
    POSTHOG_HOST: 'https://eu.i.posthog.com',
  },
}));

import { PostHog } from 'posthog-node';

import ENV from '../../src/config/env.js';
import {
  _resetAnalyticsForTests,
  capture,
  flushAnalytics,
  initAnalytics,
} from '../../src/lib/analytics.js';

describe('analytics', () => {
  beforeEach(() => {
    _resetAnalyticsForTests();
    vi.clearAllMocks();
    ENV.POSTHOG_API_KEY = 'phc_test';
  });

  it('stays disabled without a key: no client, capture and flush return immediately', async () => {
    ENV.POSTHOG_API_KEY = '';
    initAnalytics();
    capture({ distinctId: 'u1', event: 'noop' });
    await flushAnalytics();
    expect(PostHog).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.shutdown).not.toHaveBeenCalled();
  });

  it('initializes once against the configured host', () => {
    initAnalytics();
    initAnalytics();
    expect(PostHog).toHaveBeenCalledOnce();
    expect(PostHog).toHaveBeenCalledWith('phc_test', expect.objectContaining({ host: 'https://eu.i.posthog.com' }));
  });

  it('scrubs sensitive properties and falls back to the system id', () => {
    initAnalytics();
    capture({
      event: 'auth.login',
      properties: { ip: '1.2.3.4', metadata: { code: '123456', token: 't' }, password: 'p' },
    });
    expect(posthog.capture).toHaveBeenCalledWith({
      distinctId: 'system',
      event: 'auth.login',
      properties: { ip: '1.2.3.4', metadata: { code: '[REDACTED]', token: '[REDACTED]' }, password: '[REDACTED]' },
    });
  });

  it('keys events by the given distinct id', () => {
    initAnalytics();
    capture({ distinctId: 'user-1', event: 'election.open' });
    expect(posthog.capture).toHaveBeenCalledWith(
      expect.objectContaining({ distinctId: 'user-1', event: 'election.open', properties: {} }),
    );
  });

  it('never throws when the client does', () => {
    initAnalytics();
    posthog.capture.mockImplementationOnce(() => {
      throw new Error('queue full');
    });
    expect(() => {
      capture({ distinctId: 'u1', event: 'x' });
    }).not.toThrow();
  });

  it('flushes through shutdown and survives a failed flush', async () => {
    initAnalytics();
    await flushAnalytics();
    expect(posthog.shutdown).toHaveBeenCalledOnce();
    posthog.shutdown.mockRejectedValueOnce(new Error('offline'));
    await expect(flushAnalytics()).resolves.toBeUndefined();
  });
});
