// src/lib/error-reporting.ts
//
// Thin, optional Sentry seam. The app never talks to @sentry/node directly:
// everything goes through this module, which no-ops when SENTRY_DSN is unset
// (local dev, CI, tests) so the tracker is a deploy-time opt-in, not a code
// dependency. Only the error handler's already-sanitized payloads are ever
// forwarded - raw request bodies must not be passed here.
import * as Sentry from '@sentry/node';

import ENV from '../config/env.js';
import logger from '../utils/logger.js';

let enabled = false;

/**
 * Initialize Sentry once at process start (server.ts), before any request is
 * served or worker job runs. Safe to call when SENTRY_DSN is unset: reporting
 * simply stays disabled.
 */
export const initErrorReporting = (): void => {
  if (!ENV.SENTRY_DSN || enabled) return;
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    environment: ENV.NODE_ENV,
    // PII (names, phone numbers, voter ids) must stay out of the tracker; the
    // error handler already redacts what it forwards, and default PII stays off.
    sendDefaultPii: false,
    // Error tracking only - tracing would add per-request overhead and cost
    // that this deployment does not need yet.
    tracesSampleRate: 0,
  });
  enabled = true;
  logger.info('Sentry error reporting enabled');
};

export interface ReportContext {
  code?: string;
  /** MUST already be passed through the error handler's sanitizer. */
  details?: Record<string, unknown>;
  errorId: string;
  layer?: string;
  method?: string;
  path?: string;
  requestId?: string;
  severity: string;
}

/**
 * Forward an error to the tracker (no-op when disabled). Tags make events
 * searchable by the same errorId/requestId a user can quote from the API
 * response, closing the report-to-log loop.
 */
export const reportError = (error: unknown, context: ReportContext): void => {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTag('errorId', context.errorId);
    if (context.requestId) scope.setTag('requestId', context.requestId);
    if (context.layer) scope.setTag('layer', context.layer);
    if (context.code) scope.setTag('code', context.code);
    scope.setLevel(context.severity === 'critical' ? 'fatal' : 'error');
    scope.setContext('request', {
      method: context.method,
      path: context.path,
    });
    if (context.details) scope.setContext('details', context.details);
    Sentry.captureException(error);
  });
};

/**
 * Flush buffered events before process exit so shutdown/crash reports are not
 * lost. Bounded: never blocks shutdown longer than the timeout.
 */
export const flushErrorReporting = async (timeoutMs = 2000): Promise<void> => {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // Flushing is best-effort; shutdown must proceed regardless.
  }
};

/** Test-only escape hatch so specs can reset module state. */
export const _resetErrorReportingForTests = (): void => {
  enabled = false;
};
