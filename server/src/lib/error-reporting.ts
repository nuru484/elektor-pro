// src/lib/error-reporting.ts
//
// Thin, optional Sentry seam. The app never talks to @sentry/node directly:
// everything goes through this module, which no-ops when SENTRY_DSN is unset
// (local dev, CI, tests) so the tracker is a deploy-time opt-in, not a code
// dependency. Only the error handler's already-sanitized payloads are ever
// forwarded - raw request bodies must not be passed here - and `beforeSend`
// masks anything sensitive that reaches an event by another route (an SDK
// integration, an exception message quoting a payload).
import type { ErrorEvent } from '@sentry/node';

import * as Sentry from '@sentry/node';

import ENV from '../config/env.js';
import logger from '../utils/logger.js';
import { REDACTED, sanitizeErrorData, SENSITIVE_EXACT_KEYS, SENSITIVE_KEY_FRAGMENTS } from '../utils/sanitize.js';
import { getRequestUserId } from './request-store.js';

let enabled = false;

/**
 * Masks `key=value`, `key: value` and `"key":"value"` fragments in free text
 * for every sensitive key, so a message like `login failed for token=abc`
 * keeps its shape without the value.
 */
const SENSITIVE_TEXT_PATTERN = new RegExp(
  `("?)(\\w*(?:${SENSITIVE_KEY_FRAGMENTS.join('|')})\\w*|${SENSITIVE_EXACT_KEYS.join('|')})("?\\s*[=:]\\s*"?)([^\\s,;&"']+)`,
  'gi',
);

const scrubText = (text: string): string =>
  text.replace(SENSITIVE_TEXT_PATTERN, (_match, q1: string, key: string, sep: string) =>
    `${q1}${key}${sep}${REDACTED}`);

const scrubRecord = <T>(value: T): T => sanitizeErrorData(value) as T;

/**
 * Masks sensitive values wherever an event can carry them: `extra`,
 * `contexts`, `request` (headers, cookies, query, body) and the exception
 * and log message text. Keys survive so the event stays readable.
 */
export const scrubEvent = <E extends ErrorEvent>(event: E): E => {
  if (event.extra) event.extra = scrubRecord(event.extra);
  if (event.contexts) event.contexts = scrubRecord(event.contexts);
  if (event.request) {
    const { cookies, data, headers, query_string: queryString, ...rest } = event.request;
    event.request = {
      ...rest,
      ...(cookies ? { cookies: Object.fromEntries(Object.keys(cookies).map((name) => [name, REDACTED])) } : {}),
      ...(data !== undefined ? { data: typeof data === 'string' ? scrubText(data) : scrubRecord(data) } : {}),
      ...(headers ? { headers: scrubRecord(headers) } : {}),
      ...(queryString !== undefined
        ? { query_string: typeof queryString === 'string' ? scrubText(queryString) : scrubRecord(queryString) }
        : {}),
    };
  }
  if (event.message) event.message = scrubText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }
  return event;
};

/**
 * Initialize Sentry once at process start (server.ts), before any request is
 * served or worker job runs. Safe to call when SENTRY_DSN is unset: reporting
 * simply stays disabled.
 */
export const initErrorReporting = (): void => {
  if (!ENV.SENTRY_DSN || enabled) return;
  Sentry.init({
    beforeSend: (event) => scrubEvent(event),
    dsn: ENV.SENTRY_DSN,
    environment: ENV.SENTRY_ENVIRONMENT,
    release: ENV.SENTRY_RELEASE,
    // PII (names, phone numbers, voter ids) must stay out of the tracker; the
    // error handler already redacts what it forwards, and default PII stays off.
    sendDefaultPii: false,
    // Off by default: tracing adds per-request overhead and cost, so a
    // deployment opts in with a small sample rate when p95 questions arise.
    tracesSampleRate: ENV.SENTRY_TRACES_SAMPLE_RATE,
  });
  enabled = true;
  logger.info({ release: ENV.SENTRY_RELEASE }, 'Sentry error reporting enabled');
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
 * response, closing the report-to-log loop. The user is the authenticated
 * principal's opaque id only, and only while a request is running: outside
 * one (a scheduled job, a process crash) the event carries no user at all.
 */
export const reportError = (error: unknown, context: ReportContext): void => {
  if (!enabled) return;
  const userId = getRequestUserId();
  Sentry.withScope((scope) => {
    scope.setTag('errorId', context.errorId);
    if (context.requestId) scope.setTag('requestId', context.requestId);
    if (context.layer) scope.setTag('layer', context.layer);
    if (context.code) scope.setTag('code', context.code);
    scope.setLevel(context.severity === 'critical' ? 'fatal' : 'error');
    scope.setUser(userId ? { id: userId } : null);
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
