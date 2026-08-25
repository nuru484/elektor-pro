// src/utils/logger.ts
import type { Logger, LoggerOptions } from 'pino';

import pino from 'pino';

import ENV from '../config/env.js';
import { getRequestId } from '../lib/request-store.js';

const isProduction = ENV.NODE_ENV === 'production';
const isTest = ENV.NODE_ENV === 'test';

/**
 * Field names that must never reach a log line, wherever they sit in the
 * logged object. Credentials (passwords, tokens, secrets), one-time codes,
 * and the identifiers a voter signs in with (voter id, phone).
 */
const SENSITIVE_KEYS = [
  'accessToken',
  'authorization',
  'code',
  'confirmPassword',
  'cookie',
  'currentPassword',
  'newPassword',
  'otp',
  'password',
  'phone',
  'phoneNumber',
  'refreshToken',
  'secret',
  'temporaryPassword',
  'token',
  'totpSecret',
  'voterId',
];

/** pino wildcards match one level each, so cover the depths log objects use. */
const REDACT_DEPTH = 4;

const redactPaths = SENSITIVE_KEYS.flatMap((key) =>
  Array.from({ length: REDACT_DEPTH + 1 }, (_, depth) =>
    depth === 0 ? key : `${'*.'.repeat(depth)}${key}`,
  ),
).concat([
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
]);

export const loggerOptions: LoggerOptions = {
  level: ENV.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
  redact: { censor: '[REDACTED]', paths: redactPaths },
};

/**
 * Structured JSON logs in production (machine-parseable, cheap); pretty,
 * colorized output in development only. Silent under test so suite output
 * stays readable - tests that assert on logging inject their own fake logger
 * through deps.
 */
const logger = pino({
  ...loggerOptions,
  ...(isProduction || isTest
    ? {}
    : {
        transport: {
          options: {
            colorize: true,
            ignore: '',
            singleLine: false,
            translateTime: true,
          },
          target: 'pino-pretty',
        },
      }),
});

/**
 * A logger bound to the running request (or the job's originating request):
 * every line carries `requestId`, so a service or worker log links back to
 * the access-log entry and error report for the same request. Outside any
 * request it is the plain logger.
 */
export const requestLogger = (bindings: Record<string, unknown> = {}): Logger => {
  const requestId = getRequestId();
  return logger.child(requestId ? { requestId, ...bindings } : bindings);
};

export default logger;
