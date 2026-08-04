// src/middlewares/error-handler.ts
import type { NextFunction, Request, Response } from 'express';

import ENV from '../config/env.js';
import { reportError } from '../lib/error-reporting.js';
import logger from '../utils/logger.js';

/**
 * Error severity levels for better logging and monitoring
 */
export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  LOW = 'low',
  MEDIUM = 'medium',
}

/**
 * Enhanced CustomError class with additional context for better debugging
 */

/**
 * Error response interface for consistent API responses
 */
interface ErrorResponse {
  code?: string;
  details?: Record<string, unknown>;
  errorId?: string;
  message: string;
  requestId?: string;
  status: string;
}

export class CustomError extends Error {
  readonly code?: string | undefined;
  readonly context?: Record<string, unknown> | undefined;
  readonly layer: string;
  readonly severity: ErrorSeverity;
  readonly status: number;
  readonly timestamp: Date;

  constructor(
    status: number,
    message: string,
    options: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
      severity?: ErrorSeverity;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.layer = options.layer ?? 'unknown';
    this.severity = options.severity ?? ErrorSeverity.MEDIUM;
    this.timestamp = new Date();
    this.code = options.code;
    this.context = options.context;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Generate a unique error ID for tracking
 */
const generateErrorId = (): string => {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Sanitize error data for safe logging and response
 */
export const sanitizeErrorData = (data: unknown): unknown => {
  if (!data) return data;

  // Preserve array shape (mapping entries through the sanitizer); treating an
  // array as a generic object would turn it into { "0": ..., "1": ... }.
  if (Array.isArray(data)) return data.map(sanitizeErrorData);

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};

    // Deep copy and sanitize object properties
    Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
      // Skip sensitive fields. Substring matches catch the long credential
      // names; the exact-name list covers short fields the substring list
      // can't safely include: `code` carries OTP/2FA guesses and receipt
      // codes, `otp`/`pin` are credentials wherever they appear.
      if (
        ['password', 'token', 'secret', 'auth', 'key', 'credit', 'ssn'].some((k) => key.toLowerCase().includes(k)) ||
        ['code', 'otp', 'pin'].includes(key.toLowerCase())
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeErrorData(value);
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  return data;
};

/**
 * Error codes whose `code` + `context` drive a client-side UX flow (field
 * validation and similar). These carry no sensitive server internals, so
 * unlike generic errors they must reach the client in EVERY environment
 * (production strips code/details for everything else). Add a code here only
 * when the frontend genuinely branches on it.
 */
const CLIENT_ACTIONABLE_CODES = new Set(['VALIDATION_ERROR']);

/**
 * Map a Prisma known-request error to a typed CustomError so the central
 * handler formats it consistently (detected structurally to avoid importing the
 * generated client here).
 */
const normalizeError = (error: unknown): Error => {
  if (error instanceof CustomError) return error;
  if (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    'code' in error
  ) {
    const code = (error as { code: string }).code;
    const meta = (error as { meta?: Record<string, unknown> }).meta;
    switch (code) {
      case 'P2002':
        return new ConflictError('A record with these details already exists', {
          code,
          context: { target: meta?.target },
          layer: 'database',
        });
      case 'P2003':
        return new BadRequestError('Related record does not exist', {
          code,
          layer: 'database',
        });
      case 'P2025':
        return new NotFoundError('Record not found', { code, layer: 'database' });
      default:
        return new BadRequestError('Database request error', { code, layer: 'database' });
    }
  }
  if (error instanceof Error) return error;
  return new InternalServerError('Unknown error');
};

/**
 * Error handler middleware with better typing and security
 */
export const errorHandler = (rawError: CustomError | Error, req: Request, res: Response, _next: NextFunction): void => {
  const error = normalizeError(rawError);
  const isProduction = ENV.NODE_ENV === 'production';
  const errorId = generateErrorId();

  // Bodies and query strings can both carry credentials (login payloads, a
  // callback `?token=`, a reset link), so both get the sanitizer.
  const sanitizedBody = sanitizeErrorData(req.body);
  const sanitizedQuery = sanitizeErrorData(req.query);

  // Custom error with appropriate HTTP status and detailed info
  const isCustomError = error instanceof CustomError;
  const status = isCustomError ? error.status : 500;
  const severity = isCustomError ? error.severity : ErrorSeverity.HIGH;
  const layer = isCustomError ? error.layer : 'unknown';
  const code = isCustomError ? error.code : undefined;
  const context = isCustomError ? error.context : undefined;
  const sanitizedContext = sanitizeErrorData(context) as Record<string, unknown> | undefined;

  // Prepare error details for logging
  const logDetails = {
    body: sanitizedBody,
    code,
    context: sanitizedContext,
    errorId,
    ip: req.ip,
    layer,
    message: error.message,
    method: req.method,
    params: req.params,
    path: req.path,
    query: sanitizedQuery,
    requestId: req.requestId,
    severity,
    stack: !isProduction ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  };

  // Log the error with appropriate level based on severity
  switch (severity) {
    case ErrorSeverity.CRITICAL:
    case ErrorSeverity.HIGH:
      logger.error(logDetails);
      // Only HIGH/CRITICAL reach the tracker: expected 4xx noise (validation,
      // auth, not-found) stays in logs. Payload is the already-sanitized set.
      reportError(error, {
        code,
        details: {
          body: sanitizedBody,
          context: sanitizedContext,
          query: sanitizedQuery,
        },
        errorId,
        layer,
        method: req.method,
        path: req.path,
        requestId: req.requestId,
        severity,
      });
      break;
    case ErrorSeverity.LOW:
      logger.info(logDetails);
      break;
    case ErrorSeverity.MEDIUM:
      logger.warn(logDetails);
      break;
    default:
      logger.error(logDetails);
  }

  // Prepare client response
  const errorResponse: ErrorResponse = {
    message: isProduction && status === 500 ? 'Internal Server Error' : error.message || 'Internal Server Error',
    status: 'error',
  };

  // Client-actionable codes surface their code + context in every environment
  // (they drive UX flows and carry no server internals).
  if (code && CLIENT_ACTIONABLE_CODES.has(code)) {
    errorResponse.code = code;
    if (sanitizedContext) errorResponse.details = sanitizedContext;
  }

  // Always expose the correlation ids - production included. Without them a
  // user-reported failure cannot be traced to a log line or tracker event.
  // They are opaque values and leak nothing about internals.
  errorResponse.errorId = errorId;
  if (req.requestId) errorResponse.requestId = req.requestId;

  // Outside production, additionally expose code/details for debugging.
  if (!isProduction) {
    if (code) errorResponse.code = code;
    if (sanitizedContext && !errorResponse.details) errorResponse.details = sanitizedContext;
  }

  // Send appropriate response
  res.status(status).json(errorResponse);
};

/**
 * Wrapper for async route handlers to automatically catch errors
 */
export const asyncHandler = <T>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) => {
  return (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return Promise.resolve(fn(req, res, next) as Promise<void>).catch(next);
  };
};

export class BadRequestError extends CustomError {
  constructor(message = 'Bad request', options?: { code?: string; context?: Record<string, unknown>; layer?: string; }) {
    super(400, message, { ...options, severity: ErrorSeverity.LOW });
  }
}

export class ConflictError extends CustomError {
  constructor(message = 'Conflict detected', options?: { code?: string; context?: Record<string, unknown>; layer?: string; }) {
    super(409, message, { ...options, severity: ErrorSeverity.MEDIUM });
  }
}

export class ForbiddenError extends CustomError {
  constructor(
    message = 'Access forbidden, You are not allowed to access this resource',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(403, message, { ...options, severity: ErrorSeverity.MEDIUM });
  }
}

export class InternalServerError extends CustomError {
  constructor(
    message = 'Internal server error',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(500, message, { ...options, severity: ErrorSeverity.HIGH });
  }
}

export class MethodNotAllowedError extends CustomError {
  constructor(message = 'Method not allowed', options?: { code?: string; context?: Record<string, unknown>; layer?: string; }) {
    super(405, message, { ...options, severity: ErrorSeverity.MEDIUM });
  }
}

/**
 * Create specific error types for common use cases
 */
export class NotFoundError extends CustomError {
  constructor(
    message = 'Resource not found',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(404, message, { ...options, severity: ErrorSeverity.LOW });
  }
}

export class TokenExpiredError extends CustomError {
  constructor(message = 'Authentication token expired', options?: { code?: string; context?: Record<string, unknown>; layer?: string; }) {
    super(401, message, { ...options, severity: ErrorSeverity.MEDIUM });
  }
}

export class TooManyRequestsError extends CustomError {
  constructor(message = 'Too many requests', options?: { code?: string; context?: Record<string, unknown>; layer?: string; }) {
    super(429, message, { ...options, severity: ErrorSeverity.MEDIUM });
  }
}

export class UnauthorizedError extends CustomError {
  constructor(
    message = 'Unauthorized access',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(401, message, { ...options, severity: ErrorSeverity.MEDIUM });
  }
}

export class ValidationError extends CustomError {
  constructor(
    message = 'Validation failed',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(400, message, { ...options, severity: ErrorSeverity.LOW });
  }
}
