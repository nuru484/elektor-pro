// src/middlewares/validation-middleware.ts
import type { NextFunction, Request, Response } from 'express';

import { ZodError, type ZodType } from 'zod';

import { ValidationError as CustomValidationError } from './error-handler.js';

/**
 * Middleware factory for Zod validation.
 *
 * After successful parsing, the coerced/transformed result is written back to
 * req[target] so downstream handlers see typed values rather than raw
 * string-only query params or unvalidated body data.
 *
 * Note on Express 5: req.query is defined as a getter on the request prototype
 * and cannot be reassigned via `req.query = ...`, so it is redefined on the
 * request instance itself.
 */
export const validateRequest =
  (schema: ZodType, target: 'body' | 'params' | 'query' = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[target]);

      if (target === 'query') {
        Object.defineProperty(req, 'query', {
          configurable: true,
          enumerable: true,
          value: parsed,
          writable: true,
        });
      } else {
        (req as unknown as Record<string, unknown>)[target] = parsed;
      }

      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const formattedErrors = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        const validationError = new CustomValidationError('Validation Error', {
          code: 'VALIDATION_ERROR',
          context: {
            errors: formattedErrors,
          },
          layer: 'request-validation',
        });
        next(validationError); return;
      }
      next(err);
    }
  };

/**
 * Middleware factory for common CRUD operations using Zod
 */
export const validationMiddleware = {
  create: (schema: ZodType, target: 'body' | 'params' | 'query' = 'body') => [validateRequest(schema, target)],
  custom: (schema: ZodType, target: 'body' | 'params' | 'query' = 'body') => [validateRequest(schema, target)],
  delete: (schema: ZodType, target: 'body' | 'params' | 'query' = 'body') => [validateRequest(schema, target)],
  query: (schema: ZodType) => [validateRequest(schema, 'query')],
  update: (schema: ZodType, target: 'body' | 'params' | 'query' = 'body') => [validateRequest(schema, target)],
};

export default validationMiddleware;
