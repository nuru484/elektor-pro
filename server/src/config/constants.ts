// src/config/constants.ts
import type { ICloudinaryUploadOptions } from '../types/cloudinary.types.js';

export const HTTP_STATUS_CODES = {
  BAD_REQUEST: 400,
  CONFLICT: 409,
  CREATED: 201,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  NO_CONTENT: 204,
  NOT_FOUND: 404,
  OK: 200,
  SERVICE_UNAVAILABLE: 503,
  TOO_MANY_REQUESTS: 429,
  UNAUTHORIZED: 401,
  UNPROCESSABLE_ENTITY: 422,
} as const;

export const BCRYPT_SALT_ROUNDS = 12;

export const CLOUDINARY_UPLOAD_OPTIONS: Partial<ICloudinaryUploadOptions> = {
  allowedFormats: ['jpg', 'jpeg', 'png', 'gif'],
  folder: 'elektor-pro',
};

// Login hardening
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Audit-chain / ballot-chain genesis hash
export const GENESIS_HASH = '0'.repeat(64);

/**
 * Elections that are still running or about to. An accreditor or agent may
 * hold only ONE assignment among these at a time: one person cannot staff two
 * desks, or watch two candidates, at the same event. Everything outside this
 * set (ended, cancelled, archived) is history and never blocks a new posting.
 */
export const LIVE_ELECTION_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'IN_PROGRESS',
  'PAUSED',
] as const;
