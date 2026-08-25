// src/lib/analytics.ts
//
// Thin, optional PostHog seam, shaped like error-reporting.ts: the app never
// imports posthog-node anywhere else, and everything here is a no-op until
// POSTHOG_API_KEY is set. Events describe what happened (an audit action, a
// job outcome) keyed by the principal's opaque id; properties go through the
// same masking as error reports, so a credential or voter identifier that
// lands in audit metadata never reaches the analytics host.
import { PostHog } from 'posthog-node';

import ENV from '../config/env.js';
import logger from '../utils/logger.js';
import { sanitizeErrorData } from '../utils/sanitize.js';

let client: null | PostHog = null;

/** Events with no authenticated principal (system sweeps, anonymous voters). */
export const SYSTEM_DISTINCT_ID = 'system';

export interface CaptureInput {
  distinctId?: null | string;
  event: string;
  properties?: Record<string, unknown>;
}

/**
 * Initialize once at process start, next to initErrorReporting(). With no
 * key it stays disabled and capture() returns immediately.
 */
export const initAnalytics = (): void => {
  if (!ENV.POSTHOG_API_KEY || client) return;
  client = new PostHog(ENV.POSTHOG_API_KEY, {
    flushAt: 20,
    flushInterval: 10_000,
    host: ENV.POSTHOG_HOST,
  });
  // A network failure inside the client must never surface as an unhandled
  // error in the request that happened to trigger a flush.
  client.on('error', (error: unknown) => {
    logger.warn(error, 'Analytics delivery failed');
  });
  logger.info({ host: ENV.POSTHOG_HOST }, 'Product analytics enabled');
};

/**
 * Record an event. Never throws and never awaits the network: the client
 * batches in memory and delivers in the background. Properties are masked
 * with the error handler's sanitizer before they leave the process.
 */
export const capture = ({ distinctId, event, properties }: CaptureInput): void => {
  if (!client) return;
  try {
    client.capture({
      distinctId: distinctId ?? SYSTEM_DISTINCT_ID,
      event,
      properties: sanitizeErrorData(properties ?? {}) as Record<string, unknown>,
    });
  } catch (error) {
    logger.warn(error, 'Analytics capture failed');
  }
};

/**
 * Deliver whatever is still batched before the process exits. Bounded by the
 * client's own request timeout; shutdown proceeds either way.
 */
export const flushAnalytics = async (): Promise<void> => {
  if (!client) return;
  try {
    await client.shutdown();
  } catch {
    // Best-effort: losing a few events beats hanging a deploy.
  }
};

/** Test-only escape hatch so specs can reset module state. */
export const _resetAnalyticsForTests = (): void => {
  client = null;
};
