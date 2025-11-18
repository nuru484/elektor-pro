// src/middlewares/validation-middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ValidationError as CustomValidationError } from './error-handler.js';

/**
 * Middleware factory for Zod validation
 */
export const validateRequest =
  <T extends ZodType>(schema: T, target: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req[target]);
      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const formattedErrors = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        const validationError = new CustomValidationError('Validation Error', {
          layer: 'Request Validation',
          context: {
            errors: formattedErrors,
          },
        });
        return next(validationError);
      }
      next(err);
    }
  };

/**
 * Middleware factory for common CRUD operations using Zod
 */
export const validationMiddleware = {
  create: <T extends ZodType>(schema: T, target: 'body' | 'query' | 'params' = 'body') => [validateRequest(schema, target)],
  update: <T extends ZodType>(schema: T, target: 'body' | 'query' | 'params' = 'body') => [validateRequest(schema, target)],
  delete: <T extends ZodType>(schema: T, target: 'body' | 'query' | 'params' = 'body') => [validateRequest(schema, target)],
  custom: <T extends ZodType>(schema: T, target: 'body' | 'query' | 'params' = 'body') => [validateRequest(schema, target)],
};

export default validationMiddleware;
