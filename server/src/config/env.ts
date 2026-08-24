// src/config/env.ts
// Typed, fail-fast environment configuration. The app reads ENV, never process.env.

const envRequired = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const envOptional = (name: string, fallback = ""): string =>
  process.env[name] ?? fallback;

const envNumber = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return parsed;
};

const envBool = (name: string, fallback = false): boolean => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes"].includes(raw.toLowerCase());
};

const envEnum = <T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T,
): T => {
  const raw = process.env[name] as T | undefined;
  if (raw === undefined || raw === "") return fallback;
  if (!allowed.includes(raw)) {
    throw new Error(
      `Environment variable ${name} must be one of: ${allowed.join(", ")}`,
    );
  }
  return raw;
};

const isProduction = (process.env.NODE_ENV ?? "development") === "production";

/**
 * Secrets must actually be secret-sized. A short ACCESS_TOKEN_SECRET is a
 * guessable HMAC key, and every session in the system hangs off it, so this
 * is refused outright in production rather than warned about.
 */
const MIN_SECRET_LENGTH = 32;

const envSecret = (name: string): string => {
  const value = envRequired(name);
  if (isProduction && value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Environment variable ${name} must be at least ${String(MIN_SECRET_LENGTH)} characters in production`,
    );
  }
  return value;
};

interface IENV {
  ACCESS_TOKEN_EXPIRY: string;
  ACCESS_TOKEN_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_FIRST_NAME: string;
  ADMIN_LAST_NAME: string;
  ADMIN_PASSWORD: string;
  ADMIN_PHONE: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_CLOUD_NAME: string;
  COOKIE_DOMAIN: string;
  CORS_ACCESS: string;
  DATABASE_URL: string;
  /** Max connections in the shared pg pool (API + in-process workers). */
  DB_POOL_MAX: number;
  /** Demo sign-in: the seeded account behind each role button. */
  DEMO_ACCREDITOR_EMAIL: string;
  DEMO_ADMIN_EMAIL: string;
  DEMO_AGENT_EMAIL: string;
  DEMO_CANDIDATE_EMAIL: string;
  /** Off by default: a live deployment opts in explicitly. */
  DEMO_LOGIN_ENABLED: boolean;
  DEMO_SUPER_ADMIN_EMAIL: string;
  /** Voters sign in by voter ID, not email. */
  DEMO_VOTER_ID: string;
  /** Client origin used in emailed links (password reset, invitations). */
  EMAIL_LOGO_URL: string | undefined;
  /**
   * Key for data encrypted at rest (TOTP secrets). Separate from the JWT
   * secrets on purpose: were it derived from ACCESS_TOKEN_SECRET, rotating
   * that token secret - a routine operation - would silently make every
   * stored TOTP secret undecryptable and lock out every 2FA user. Required in
   * production; outside it, falls back to the access secret so existing dev
   * databases keep working.
   */
  ENCRYPTION_KEY: string;
  /**
   * Where background-generated exports are written. Must be a path this
   * process can write and, on a host with more than one instance, one they
   * share - a file written by one instance is not readable by another.
   */
  EXPORT_DIR: string;
  FROG_API_KEY: string;
  FROG_SENDER_ID: string;
  FROG_USERNAME: string;
  FRONTEND_URL: string;
  /** Sender for outgoing mail; must be on a Resend-verified domain. */
  MAIL_FROM: string;
  NODE_ENV: string;
  /** Notification worker: messages in flight at once. */
  NOTIFICATION_CONCURRENCY: number;
  /** Notification worker: ceiling per second, to respect provider limits. */
  NOTIFICATION_PER_SECOND: number;
  OTP_LENGTH: number;
  OTP_MODE: "live" | "mock";
  OTP_TTL_MINUTES: number;
  PORT: number;
  /** Internal callers presenting this via X-Rate-Limit-Bypass skip rate limits. */
  RATE_LIMIT_BYPASS_SECRET: string;
  /**
   * Multiplier applied to every limiter's max requests. Defaults to a
   * generous 100x outside production so development never trips limits;
   * production defaults to 1 (the real limits). Override per environment
   * with RATE_LIMIT_SCALE.
   */
  RATE_LIMIT_SCALE: number;
  /** BullMQ connection; empty disables background queues (dev without Redis). */
  REDIS_URL: string;
  REFRESH_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_SECRET: string;
  /** Resend API key; empty switches email to mock mode (dev, CI, tests). */
  RESEND_API_KEY: string;
  /** Error-tracker DSN; empty disables reporting (dev, CI, tests). */
  SENTRY_DSN: string;
}

const ENV: IENV = {
  ACCESS_TOKEN_EXPIRY: envOptional("ACCESS_TOKEN_EXPIRY", "30m"),
  ACCESS_TOKEN_SECRET: envSecret("ACCESS_TOKEN_SECRET"),
  ADMIN_EMAIL: envOptional("ADMIN_EMAIL", "admin@elektorpro.com"),
  ADMIN_FIRST_NAME: envOptional("ADMIN_FIRST_NAME", "Super"),
  ADMIN_LAST_NAME: envOptional("ADMIN_LAST_NAME", "Admin"),
  ADMIN_PASSWORD: envOptional("ADMIN_PASSWORD", "ChangeMe123!"),
  ADMIN_PHONE: envOptional("ADMIN_PHONE", "+233200000000"),
  CLOUDINARY_API_KEY: envOptional("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: envOptional("CLOUDINARY_API_SECRET"),
  CLOUDINARY_CLOUD_NAME: envOptional("CLOUDINARY_CLOUD_NAME"),
  COOKIE_DOMAIN: envOptional("COOKIE_DOMAIN"),
  CORS_ACCESS: envOptional("CORS_ACCESS", "http://localhost:3000"),
  DATABASE_URL: envRequired("DATABASE_URL"),
  DB_POOL_MAX: envNumber("DB_POOL_MAX", 20),
  DEMO_ACCREDITOR_EMAIL: envOptional(
    "DEMO_ACCREDITOR_EMAIL",
    "demo.accreditor@elektorpro.app",
  ),
  DEMO_ADMIN_EMAIL: envOptional("DEMO_ADMIN_EMAIL", "demo.admin@elektorpro.app"),
  DEMO_AGENT_EMAIL: envOptional("DEMO_AGENT_EMAIL", "demo.agent@elektorpro.app"),
  DEMO_CANDIDATE_EMAIL: envOptional(
    "DEMO_CANDIDATE_EMAIL",
    "demo.candidate@elektorpro.app",
  ),
  DEMO_LOGIN_ENABLED: envBool("DEMO_LOGIN_ENABLED"),
  DEMO_SUPER_ADMIN_EMAIL: envOptional(
    "DEMO_SUPER_ADMIN_EMAIL",
    "demo.superadmin@elektorpro.app",
  ),
  DEMO_VOTER_ID: envOptional("DEMO_VOTER_ID", "DEMO-VOTER-001"),
  /**
   * Masthead logo in every email, fetched by the recipient's client. Falls
   * back to the organization's own logo, then the frontend's file - which
   * only resolves once FRONTEND_URL is a public https origin.
   */
  EMAIL_LOGO_URL: envOptional("EMAIL_LOGO_URL"),
  ENCRYPTION_KEY: isProduction
    ? envSecret("ENCRYPTION_KEY")
    : envOptional("ENCRYPTION_KEY") || envRequired("ACCESS_TOKEN_SECRET"),
  EXPORT_DIR: envOptional("EXPORT_DIR", "./storage/exports"),
  FROG_API_KEY: envOptional("FROG_API_KEY"),
  FROG_SENDER_ID: envOptional("FROG_SENDER_ID"),
  FROG_USERNAME: envOptional("FROG_USERNAME"),
  FRONTEND_URL: envOptional("FRONTEND_URL", "http://localhost:3000"),
  MAIL_FROM: envOptional("MAIL_FROM", "Elektor Pro <no-reply@manuru.dev>"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  NOTIFICATION_CONCURRENCY: envNumber("NOTIFICATION_CONCURRENCY", 5),
  NOTIFICATION_PER_SECOND: envNumber("NOTIFICATION_PER_SECOND", 10),
  OTP_LENGTH: envNumber("OTP_LENGTH", 6),
  OTP_MODE: envEnum(
    "OTP_MODE",
    ["live", "mock"] as const,
    isProduction ? "live" : "mock",
  ),
  OTP_TTL_MINUTES: envNumber("OTP_TTL_MINUTES", 10),
  // Default matches .env.example and the client's NEXT_PUBLIC_API_URL fallback.
  PORT: envNumber("PORT", 4040),
  RATE_LIMIT_BYPASS_SECRET: envOptional("RATE_LIMIT_BYPASS_SECRET"),
  RATE_LIMIT_SCALE: envNumber("RATE_LIMIT_SCALE", isProduction ? 1 : 1000),
  REDIS_URL: envOptional("REDIS_URL"),
  REFRESH_TOKEN_EXPIRY: envOptional("REFRESH_TOKEN_EXPIRY", "7d"),
  REFRESH_TOKEN_SECRET: envSecret("REFRESH_TOKEN_SECRET"),
  RESEND_API_KEY: envOptional("RESEND_API_KEY"),
  SENTRY_DSN: envOptional("SENTRY_DSN"),
};

if (ENV.OTP_MODE === "live" && !ENV.FROG_API_KEY) {
  throw new Error("OTP_MODE=live requires FROG_API_KEY to be set");
}

export default ENV;
