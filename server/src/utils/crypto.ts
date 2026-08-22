// src/utils/crypto.ts
// Hashing, hash-chaining, secret encryption, and code generation primitives.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

import ENV from '../config/env.js';

/** SHA-256 hex digest of a string. */
export const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/**
 * Hash-chain link: hash of the previous hash concatenated with a canonical
 * JSON of the current payload. Used for the audit log and ballot chains.
 */
export const chainHash = (
  prevHash: string,
  payload: Record<string, unknown>,
): string => sha256(`${prevHash}:${stableStringify(payload)}`);

/** Deterministic JSON stringify (sorted keys) so hashes are reproducible. */
export const stableStringify = (value: unknown): string => {
  const seen = new WeakSet();
  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    if (seen.has(input)) return undefined;
    seen.add(input);
    if (Array.isArray(input)) return input.map(normalize);
    return Object.keys(input)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalize((input as Record<string, unknown>)[key]);
        return acc;
      }, {});
  };
  return JSON.stringify(normalize(value));
};

/** Constant-time comparison of two hex/utf8 strings of equal byte length. */
export const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

/** Generate a numeric OTP of the configured length. */
export const generateNumericCode = (length: number): string => {
  let code = '';
  for (let i = 0; i < length; i += 1) code += randomInt(0, 10).toString();
  return code;
};

/** URL-safe random token (default 32 bytes → 43 chars base64url). */
export const generateToken = (bytes = 32): string =>
  randomBytes(bytes).toString('base64url');

/** Human-friendly receipt / recovery code, e.g. "7Q4K-9XPM-2R8T". */
export const generateReceiptCode = (groups = 3, groupLen = 4): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () =>
    Array.from({ length: groupLen }, () => alphabet[randomInt(0, alphabet.length)]).join('');
  return Array.from({ length: groups }, part).join('-');
};

// --- Symmetric encryption (AES-256-GCM) for secrets at rest (TOTP secret) ---

const SALT = 'elektor-pro-secret-salt';
const KEY = scryptSync(ENV.ENCRYPTION_KEY, SALT, 32);

/**
 * Legacy key: rows written before ENCRYPTION_KEY was split out of
 * ACCESS_TOKEN_SECRET are encrypted under the access secret. Decryption falls
 * back to it so moving to a dedicated key does not strand those rows. Nothing
 * is ever ENCRYPTED with it, so the fallback disappears naturally as secrets
 * are re-enrolled.
 */
const LEGACY_KEY =
  ENV.ENCRYPTION_KEY === ENV.ACCESS_TOKEN_SECRET
    ? null
    : scryptSync(ENV.ACCESS_TOKEN_SECRET, SALT, 32);

export const encryptSecret = (plaintext: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptWith = (key: Buffer, iv: string, tag: string, data: string): string => {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

export const decryptSecret = (payload: string): string => {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted secret');
  }
  try {
    return decryptWith(KEY, ivB64, tagB64, dataB64);
  } catch (error) {
    // GCM authentication failed: either the wrong key, or real tampering.
    // Only the legacy key is worth a second attempt.
    if (!LEGACY_KEY) throw error;
    return decryptWith(LEGACY_KEY, ivB64, tagB64, dataB64);
  }
};
