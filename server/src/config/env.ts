// src/config/env.ts
export function assertEnv<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

interface IENV {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  CORS_ACCESS: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  ACCESS_TOKEN_SECRET: string;
  ACCESS_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_SECRET: string;
  REFRESH_TOKEN_EXPIRY: string;
  COOKIE_DOMAIN: string;
  REDIS_URL: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  GMAIL_USER: string;
  GMAIL_PASSWORD: string;
  SMTP_SECURE: string;
  FROG_API_KEY: string;
  FROG_SENDER_ID: string;
  FROG_USERNAME: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  ADMIN_FIRST_NAME: string;
  ADMIN_LAST_NAME: string;
  ADMIN_PHONE: string;
}

const ENV: IENV = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ACCESS: assertEnv(process.env.CORS_ACCESS, 'CORS_ACCESS'),
  DATABASE_URL: assertEnv(process.env.DATABASE_URL, 'DATABASE_URL'),

  CLOUDINARY_CLOUD_NAME: assertEnv(
    process.env.CLOUDINARY_CLOUD_NAME,
    'CLOUDINARY_CLOUD_NAME',
  ),
  CLOUDINARY_API_KEY: assertEnv(
    process.env.CLOUDINARY_API_KEY,
    'CLOUDINARY_API_KEY',
  ),
  CLOUDINARY_API_SECRET: assertEnv(
    process.env.CLOUDINARY_API_SECRET,
    'CLOUDINARY_API_SECRET',
  ),

  COOKIE_DOMAIN: assertEnv(process.env.COOKIE_DOMAIN, 'COOKIE_DOMAIN'),
  ACCESS_TOKEN_SECRET: assertEnv(
    process.env.ACCESS_TOKEN_SECRET,
    'ACCESS_TOKEN_SECRET',
  ),
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '30m',
  REFRESH_TOKEN_SECRET: assertEnv(
    process.env.REFRESH_TOKEN_SECRET,
    'REFRESH_TOKEN_SECRET',
  ),
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  REDIS_URL: assertEnv(process.env.REDIS_URL, 'REDIS_URL'),

  SMTP_HOST: assertEnv(process.env.SMTP_HOST, 'SMTP_HOST'),
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  GMAIL_USER: assertEnv(process.env.GMAIL_USER, 'GMAIL_USER'),
  GMAIL_PASSWORD: assertEnv(process.env.GMAIL_PASSWORD, 'GMAIL_PASSWORD'),
  SMTP_SECURE: assertEnv(process.env.SMTP_SECURE, 'SMTP_SECURE'),

  FROG_API_KEY: assertEnv(process.env.FROG_API_KEY, 'FROG_API_KEY'),
  FROG_SENDER_ID: assertEnv(process.env.FROG_SENDER_ID, 'FROG_SENDER_ID'),
  FROG_USERNAME: assertEnv(process.env.FROG_USERNAME, 'FROG_USERNAME'),

  ADMIN_EMAIL: assertEnv(process.env.ADMIN_EMAIL, 'ADMIN_EMAIL'),
  ADMIN_PASSWORD: assertEnv(process.env.ADMIN_PASSWORD, 'ADMIN_PASSWORD'),
  ADMIN_FIRST_NAME: assertEnv(process.env.ADMIN_FIRST_NAME, 'ADMIN_FIRST_NAME'),
  ADMIN_LAST_NAME: assertEnv(process.env.ADMIN_LAST_NAME, 'ADMIN_LAST_NAME'),
  ADMIN_PHONE: assertEnv(process.env.ADMIN_PHONE, 'ADMIN_PHONE'),
};

export default ENV;
