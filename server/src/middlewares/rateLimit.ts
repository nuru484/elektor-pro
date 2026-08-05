// src/middlewares/rateLimit.ts
import type { NextFunction, Request, Response } from "express";

import rateLimit, {
  ipKeyGenerator,
  type RateLimitRequestHandler,
} from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

import ENV from "../config/env.js";
import { createRedisConnection } from "../jobs/connection.js";
import { CustomError, ErrorSeverity } from "./error-handler.js";

// Custom rate limit exceeded error
export class RateLimitExceededError extends CustomError {
  constructor(message = "Rate limit exceeded") {
    super(429, message, {
      code: "RATE_LIMIT_EXCEEDED",
      layer: "middleware",
      severity: ErrorSeverity.MEDIUM,
    });
  }
}

/**
 * One shared Redis client for every limiter. With REDIS_URL set, counters
 * live in Redis and SURVIVE process restarts - the in-memory default store
 * is per-process RAM, which is why a restart used to clear active blocks.
 * Without Redis (CI, tests, bare dev) limiters fall back to memory.
 */
const rateLimitRedis = createRedisConnection();
let storeSequence = 0;

/** Close the shared rate-limit Redis client (coordinated shutdown path). */
export const closeRateLimitStore = async (): Promise<void> => {
  if (rateLimitRedis) await rateLimitRedis.quit().catch(() => undefined);
};

const makeStore = (): RedisStore | undefined => {
  if (!rateLimitRedis) return undefined;
  // Each limiter needs its own prefix so their counters never collide.
  storeSequence += 1;
  const prefix = `rl:${String(storeSequence)}:`;
  return new RedisStore({
    prefix,
    sendCommand: async (command, ...args) =>
      rateLimitRedis.call(command, ...args) as Promise<never>,
  });
};

/**
 * Create a rate limiter. Every limit is multiplied by ENV.RATE_LIMIT_SCALE -
 * 1 in production (the real limits), a generous default outside it so
 * development never trips them.
 */
export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000,
  maxRequests = 100,
  message = "Too many requests, please try again later.",
): RateLimitRequestHandler => {
  return rateLimit({
    // Custom handler for rate limit exceeded
    handler: (_req: Request, res: Response, next: NextFunction) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set("Retry-After", String(retryAfter));
      next(new RateLimitExceededError(message));
    },
    // Advanced key generation - combine IP with user ID when available
    keyGenerator: (req: Request): string => {
      const ipKey = ipKeyGenerator(req.ip ?? ""); // Use ipKeyGenerator for normalized IP
      const userId = req.user?.id ? `-user-${req.user.id}` : "";
      return `${ipKey}${userId}`;
    },
    legacyHeaders: false,
    max: Math.max(1, Math.round(maxRequests * ENV.RATE_LIMIT_SCALE)),
    message,
    // Skip rate limiting for certain requests
    skip: (req: Request) => {
      // Skip health checks
      if (req.path === "/health" || req.path === "/ping") return true;

      // Skip for internal requests presenting the configured secret. Only
      // honour the bypass when a secret is actually set - otherwise an unset
      // env var would make `undefined === undefined` true and disable all
      // rate limiting for every request.
      const secret = ENV.RATE_LIMIT_BYPASS_SECRET;
      return Boolean(secret) && req.get("X-Rate-Limit-Bypass") === secret;
    },

    standardHeaders: true,

    store: makeStore(),

    windowMs,
  });
};

// Different limiters for different endpoints
export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  500,
  "Too many authentication attempts, please try again later.",
);

export const passwordResetLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  5, // 5 requests
  "Too many password reset attempts, please try again later.",
);

/**
 * Election-day write paths (ballot casting, code sign-in): far above any
 * legitimate per-person rate, low enough to blunt scripted abuse.
 */
export const votingLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  30,
  "Too many voting requests, please slow down.",
);

export const globalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  1000, // 1000 requests per IP per window
  "Too many requests from this IP",
);

// API-specific limiter
export const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  "API rate limit exceeded",
);

// File upload limiter
export const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads per hour
  "Upload limit exceeded",
);
