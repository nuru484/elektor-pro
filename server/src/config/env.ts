// src/config/env.ts
// Typed, fail-fast environment configuration. The app reads ENV — never process.env.

const envRequired = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const envOptional = (name: string, fallback = ''): string =>
  process.env[name] ?? fallback;

const envNumber = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return parsed;
};

const envEnum = <T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T,
): T => {
  const raw = process.env[name] as T | undefined;
  if (raw === undefined || raw === '') return fallback;
  if (!allowed.includes(raw)) {
    throw new Error(
      `Environment variable ${name} must be one of: ${allowed.join(', ')}`,
    );
  }
  return raw;
};

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

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
  FROG_API_KEY: string;
  FROG_SENDER_ID: string;
  FROG_USERNAME: string;
  /** Client origin used in emailed links (password reset, invitations). */
  FRONTEND_URL: string;
  GMAIL_PASSWORD: string;
  GMAIL_USER: string;
  NODE_ENV: string;
  OTP_LENGTH: number;
  OTP_MODE: 'live' | 'mock';
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
  /** Error-tracker DSN; empty disables reporting (dev, CI, tests). */
  SENTRY_DSN: string;
  SMTP_HOST: string;
  SMTP_MAIL: string;
  SMTP_PORT: number;
  SMTP_SECURE: string;
}

const ENV: IENV = {
  ACCESS_TOKEN_EXPIRY: envOptional('ACCESS_TOKEN_EXPIRY', '30m'),
  ACCESS_TOKEN_SECRET: envRequired('ACCESS_TOKEN_SECRET'),
  ADMIN_EMAIL: envOptional('ADMIN_EMAIL', 'admin@elektorpro.com'),
  ADMIN_FIRST_NAME: envOptional('ADMIN_FIRST_NAME', 'Super'),
  ADMIN_LAST_NAME: envOptional('ADMIN_LAST_NAME', 'Admin'),
  ADMIN_PASSWORD: envOptional('ADMIN_PASSWORD', 'ChangeMe123!'),
  ADMIN_PHONE: envOptional('ADMIN_PHONE', '+233200000000'),
  CLOUDINARY_API_KEY: envOptional('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: envOptional('CLOUDINARY_API_SECRET'),
  CLOUDINARY_CLOUD_NAME: envOptional('CLOUDINARY_CLOUD_NAME'),
  COOKIE_DOMAIN: envOptional('COOKIE_DOMAIN'),
  CORS_ACCESS: envOptional('CORS_ACCESS', 'http://localhost:3000'),
  DATABASE_URL: envRequired('DATABASE_URL'),
  DB_POOL_MAX: envNumber('DB_POOL_MAX', 20),
  FROG_API_KEY: envOptional('FROG_API_KEY'),
  FROG_SENDER_ID: envOptional('FROG_SENDER_ID'),
  FROG_USERNAME: envOptional('FROG_USERNAME'),
  FRONTEND_URL: envOptional('FRONTEND_URL', 'http://localhost:3000'),
  GMAIL_PASSWORD: envOptional('GMAIL_PASSWORD'),
  GMAIL_USER: envOptional('GMAIL_USER'),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  OTP_LENGTH: envNumber('OTP_LENGTH', 6),
  OTP_MODE: envEnum('OTP_MODE', ['live', 'mock'] as const, isProduction ? 'live' : 'mock'),
  OTP_TTL_MINUTES: envNumber('OTP_TTL_MINUTES', 10),
  // Default matches .env.example and the client's NEXT_PUBLIC_API_URL fallback.
  PORT: envNumber('PORT', 4040),
  RATE_LIMIT_BYPASS_SECRET: envOptional('RATE_LIMIT_BYPASS_SECRET'),
  RATE_LIMIT_SCALE: envNumber('RATE_LIMIT_SCALE', isProduction ? 1 : 100),
  REDIS_URL: envOptional('REDIS_URL'),
  REFRESH_TOKEN_EXPIRY: envOptional('REFRESH_TOKEN_EXPIRY', '7d'),
  REFRESH_TOKEN_SECRET: envRequired('REFRESH_TOKEN_SECRET'),
  SENTRY_DSN: envOptional('SENTRY_DSN'),
  SMTP_HOST: envOptional('SMTP_HOST'),
  SMTP_MAIL: envOptional('SMTP_MAIL'),
  SMTP_PORT: envNumber('SMTP_PORT', 587),
  SMTP_SECURE: envOptional('SMTP_SECURE', 'false'),
};

if (ENV.OTP_MODE === 'live' && !ENV.FROG_API_KEY) {
  throw new Error('OTP_MODE=live requires FROG_API_KEY to be set');
}

export default ENV;
