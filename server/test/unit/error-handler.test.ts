import type { NextFunction, Request, Response } from 'express';

import { describe, expect, it, vi } from 'vitest';

import {
  BadRequestError,
  ConflictError,
  CustomError,
  errorHandler,
  ErrorSeverity,
  NotFoundError,
  sanitizeErrorData,
  ValidationError,
} from '../../src/middlewares/error-handler.js';

interface CapturedResponse {
  body?: Record<string, unknown>;
  status?: number;
}

const runHandler = (
  error: Error,
  reqOverrides: Partial<Request> = {},
): CapturedResponse => {
  const captured: CapturedResponse = {};
  const req = {
    body: {},
    ip: '127.0.0.1',
    method: 'GET',
    params: {},
    path: '/test',
    query: {},
    requestId: 'req-123',
    ...reqOverrides,
  } as unknown as Request;
  const res = {
    json(payload: Record<string, unknown>) {
      captured.body = payload;
      return this;
    },
    status(code: number) {
      captured.status = code;
      return this;
    },
  } as unknown as Response;
  errorHandler(error, req, res, vi.fn() as unknown as NextFunction);
  return captured;
};

describe('sanitizeErrorData', () => {
  it('redacts substring-matched credential fields', () => {
    const result = sanitizeErrorData({
      accessToken: 'abc',
      apiKey: 'k',
      email: 'a@b.com',
      password: 'secret',
    }) as Record<string, unknown>;
    expect(result.password).toBe('[REDACTED]');
    expect(result.accessToken).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
    expect(result.email).toBe('a@b.com');
  });

  it('redacts exact-name short credential fields (code / otp / pin)', () => {
    const result = sanitizeErrorData({
      code: '123456',
      otp: '999999',
      pin: '0000',
      postcode: 'GA-100',
    }) as Record<string, unknown>;
    expect(result.code).toBe('[REDACTED]');
    expect(result.otp).toBe('[REDACTED]');
    expect(result.pin).toBe('[REDACTED]');
    // Substring "code" must NOT redact unrelated fields.
    expect(result.postcode).toBe('GA-100');
  });

  it('sanitizes nested objects recursively', () => {
    const result = sanitizeErrorData({
      user: { password: 'x', profile: { totpSecret: 'y' } },
    }) as { user: { password: string; profile: { totpSecret: string } } };
    expect(result.user.password).toBe('[REDACTED]');
    expect(result.user.profile.totpSecret).toBe('[REDACTED]');
  });

  it('passes primitives and nullish values through', () => {
    expect(sanitizeErrorData(null)).toBeNull();
    expect(sanitizeErrorData(undefined)).toBeUndefined();
    expect(sanitizeErrorData('plain')).toBe('plain');
    expect(sanitizeErrorData(42)).toBe(42);
  });
});

describe('errorHandler', () => {
  it('always exposes errorId and requestId in the response', () => {
    const { body } = runHandler(new NotFoundError('Missing'));
    expect(body?.errorId).toMatch(/^err_/);
    expect(body?.requestId).toBe('req-123');
    expect(body?.status).toBe('error');
    expect(body?.message).toBe('Missing');
  });

  it('uses the CustomError status code', () => {
    expect(runHandler(new NotFoundError()).status).toBe(404);
    expect(runHandler(new BadRequestError()).status).toBe(400);
    expect(runHandler(new ConflictError()).status).toBe(409);
  });

  it('defaults unknown errors to 500', () => {
    const { body, status } = runHandler(new Error('boom'));
    expect(status).toBe(500);
    expect(body?.message).toBe('boom'); // not production: real message
  });

  it('surfaces VALIDATION_ERROR code and details (client-actionable)', () => {
    const error = new ValidationError('Validation Error', {
      code: 'VALIDATION_ERROR',
      context: { errors: [{ field: 'name', message: 'Required' }] },
    });
    const { body, status } = runHandler(error);
    expect(status).toBe(400);
    expect(body?.code).toBe('VALIDATION_ERROR');
    expect(body?.details).toEqual({ errors: [{ field: 'name', message: 'Required' }] });
  });

  it('sanitizes credential fields inside exposed context', () => {
    const error = new ValidationError('Validation Error', {
      code: 'VALIDATION_ERROR',
      context: { password: 'super-secret' },
    });
    const { body } = runHandler(error);
    expect((body?.details as Record<string, unknown>).password).toBe('[REDACTED]');
  });

  it('normalizes Prisma unique-constraint errors to 409', () => {
    const prismaError = new Error('Unique constraint failed');
    prismaError.name = 'PrismaClientKnownRequestError';
    (prismaError as unknown as { code: string }).code = 'P2002';
    const { body, status } = runHandler(prismaError);
    expect(status).toBe(409);
    expect(body?.message).toBe('A record with these details already exists');
  });

  it('normalizes Prisma not-found errors to 404', () => {
    const prismaError = new Error('Record not found');
    prismaError.name = 'PrismaClientKnownRequestError';
    (prismaError as unknown as { code: string }).code = 'P2025';
    expect(runHandler(prismaError).status).toBe(404);
  });

  it('carries severity metadata on CustomError', () => {
    const error = new CustomError(418, 'teapot', { severity: ErrorSeverity.LOW });
    expect(error.severity).toBe(ErrorSeverity.LOW);
    expect(runHandler(error).status).toBe(418);
  });
});
