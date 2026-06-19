// src/middlewares/rateLimit.ts
import type { NextFunction, Request, Response } from 'express';

import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';

import { CustomError, ErrorSeverity } from './error-handler.js';

// Custom rate limit exceeded error
export class RateLimitExceededError extends CustomError {
  constructor(message = 'Rate limit exceeded') {
    super(429, message, {
      code: 'RATE_LIMIT_EXCEEDED',
      layer: 'middleware',
      severity: ErrorSeverity.MEDIUM,
    });
  }
}

// Create enhanced memory-based rate limiter
export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000,
  maxRequests = 100,
  message = 'Too many requests, please try again later.',
): RateLimitRequestHandler => {
  return rateLimit({
    // Custom handler for rate limit exceeded
    handler: (_req: Request, res: Response, next: NextFunction) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set('Retry-After', String(retryAfter));
      next(new RateLimitExceededError(message));
    },
    // Advanced key generation - combine IP with user ID when available
    keyGenerator: (req: Request): string => {
      const ipKey = ipKeyGenerator(req.ip ?? ''); // Use ipKeyGenerator for normalized IP
      const userId = req.user?.id ? `-user-${req.user.id}` : '';
      return `${ipKey}${userId}`;
    },
    legacyHeaders: false,
    max: maxRequests,
    message,

    // Skip rate limiting for certain requests
    skip: (req: Request) => {
      // Skip health checks
      if (req.path === '/health' || req.path === '/ping') return true;

      // Skip for internal requests with secret header
      const bypassToken = req.get('X-Rate-Limit-Bypass');
      return bypassToken === process.env.RATE_LIMIT_BYPASS_SECRET;
    },

    standardHeaders: true,

    windowMs,
  });
};

// Different limiters for different endpoints
export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 50, 'Too many authentication attempts, please try again later.');

export const passwordResetLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  5, // 5 requests
  'Too many password reset attempts, please try again later.',
);

export const globalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  1000, // 1000 requests per IP per window
  'Too many requests from this IP',
);

// API-specific limiter
export const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'API rate limit exceeded',
);

// File upload limiter
export const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads per hour
  'Upload limit exceeded',
);
