// src/middlewares/rateLimit.ts
import type { NextFunction, Request, Response } from "express";

import rateLimit, {
  ipKeyGenerator,
  type RateLimitRequestHandler,
} from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

import ENV from "../config/env.js";
import { createRedisConnection } from "../jobs/connection.js";
import { sha256 } from "../utils/crypto.js";
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
 * is per-process RAM, so a restart there clears every active block.
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
 * Default bucket key.
 *
 * `req.user` is only populated by route-level authenticateJWT, so an
 * app-level limiter never sees it and would key EVERY request by IP alone,
 * capping a whole institution - every voter behind one campus NAT, plus
 * every admin - at a single shared budget.
 *
 * So fall back to the session cookie, which cookie-parser has already put on
 * the request by the time any limiter runs: it gives each signed-in device
 * its own bucket without verifying (or logging) the token. Only genuinely
 * anonymous traffic is keyed by IP.
 */
const defaultKey = (req: Request): string => {
  if (req.user?.id) return `user:${req.user.id}`;
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const token = cookies?.accessToken ?? cookies?.refreshToken;
  // Hashed, and truncated: the raw token must never reach a Redis key.
  if (token) return `sess:${sha256(token).slice(0, 32)}`;
  return ipKeyGenerator(req.ip ?? "");
};

export interface RateLimiterOptions {
  /**
   * Bucket the limit by something request-specific instead of the caller -
   * e.g. the account being signed into. Credential stuffing is per-account,
   * so limiting per account stops it without punishing everyone sharing an
   * institutional IP. Return undefined to fall back to the default key.
   */
  keyBy?: (req: Request) => string | undefined;
}

/**
 * Create a rate limiter. Every limit is multiplied by ENV.RATE_LIMIT_SCALE -
 * 1 in production (the real limits), a generous default outside it so
 * development never trips them.
 */
export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000,
  maxRequests = 100,
  message = "Too many requests, please try again later.",
  options: RateLimiterOptions = {},
): RateLimitRequestHandler => {
  return rateLimit({
    // Custom handler for rate limit exceeded
    handler: (_req: Request, res: Response, next: NextFunction) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set("Retry-After", String(retryAfter));
      next(new RateLimitExceededError(message));
    },
    keyGenerator: (req: Request): string =>
      options.keyBy?.(req) ?? defaultKey(req),
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

/**
 * The account an auth request is aimed at. Login, voter OTP, and code sign-in
 * all name their target in the body under one of these keys.
 */
const authTargetKey = (req: Request): string | undefined => {
  const body = req.body as Record<string, unknown> | undefined;
  const target =
    body?.emailOrPhone ?? body?.identifier ?? body?.voterId ?? undefined;
  if (typeof target !== "string" || target.trim() === "") return undefined;
  return `auth:${sha256(target.trim().toLowerCase()).slice(0, 32)}`;
};

/**
 * Auth attempts are limited PER ACCOUNT, not per IP.
 *
 * Credential stuffing targets one account at a time, so this is where the
 * limit bites; keying by IP instead would make a whole campus behind one NAT
 * share a single login budget on the one day everybody signs in at once.
 * Per-IP flooding is still bounded by the global limiter below, and the
 * per-account defences (lockout after MAX_FAILED_LOGIN_ATTEMPTS, the OTP
 * resend window, OTP attempt limits) are unaffected.
 */
export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  30,
  "Too many authentication attempts for this account, please try again later.",
  { keyBy: authTargetKey },
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

/**
 * The blanket limiter in front of the whole API. It is a flood guard, not a
 * usage quota: a console page fans out into many parallel queries, so a
 * 100-per-15-minutes ceiling throws 429s at admins doing ordinary work
 * (the 100th request of a normal session). The budget is per signed-in
 * device (see defaultKey), which is what makes a generous ceiling safe -
 * anonymous callers still share their IP's bucket.
 */
export const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  3000,
  "API rate limit exceeded",
);

/**
 * Whole-chain verification re-derives every ballot in an election, so it is
 * far more expensive to serve than a normal read and it is deliberately
 * public. Limit it well below the general API budget; the service also caches
 * the result between casts.
 */
export const integrityVerifyLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10,
  "Too many verification requests, please try again shortly.",
);

// File upload limiter
export const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads per hour
  "Upload limit exceeded",
);

/**
 * Demo sign-in. Every hit mints a session, so a `skipSuccessfulRequests`
 * limiter would never actually limit it - all attempts are counted. The cap
 * is generous enough for a visitor trying each role in turn, low enough that
 * the open endpoint cannot be farmed for sessions.
 */
export const demoLoginLimiter = createRateLimiter(
  15 * 60 * 1000,
  30,
  "Too many demo sign-ins. Please try again in a few minutes.",
);
