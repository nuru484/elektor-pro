// src/utils/jwt.ts
import jwt, { type SignOptions } from 'jsonwebtoken';

import type { Role } from '../../generated/prisma/client.js';

import ENV from '../config/env.js';
import { UnauthorizedError } from '../middlewares/error-handler.js';
import { sha256 } from './crypto.js';

export interface AccessPayload {
  id: string;
  role: Role;
}

export interface TwoFactorChallengePayload {
  id: string;
  purpose: 'two_factor';
}

// Distinct signing key for short-lived 2FA challenge tokens, so a pre-2FA
// challenge token can never be accepted as an access/refresh token (and vice
// versa) even though it is derived deterministically from the access secret.
const TWO_FACTOR_SECRET = sha256(`${ENV.ACCESS_TOKEN_SECRET}::two_factor_challenge`);

export const signAccessToken = (payload: AccessPayload): string =>
  jwt.sign(payload, ENV.ACCESS_TOKEN_SECRET, {
    expiresIn: ENV.ACCESS_TOKEN_EXPIRY,
  } as SignOptions);

export const signRefreshToken = (payload: AccessPayload): string =>
  jwt.sign(payload, ENV.REFRESH_TOKEN_SECRET, {
    expiresIn: ENV.REFRESH_TOKEN_EXPIRY,
  } as SignOptions);

export const signTwoFactorChallenge = (userId: string): string =>
  jwt.sign(
    { id: userId, purpose: 'two_factor' } satisfies TwoFactorChallengePayload,
    TWO_FACTOR_SECRET,
    { expiresIn: '5m' },
  );

export const verifyAccessToken = (token: string): AccessPayload => {
  const decoded = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET) as Record<
    string,
    unknown
  >;
  // Reject any token that carries a non-access purpose (defense in depth).
  if ('purpose' in decoded) {
    throw new UnauthorizedError('Invalid token');
  }
  return decoded as unknown as AccessPayload;
};

export const verifyTwoFactorChallenge = (
  token: string,
): TwoFactorChallengePayload => {
  let decoded: Record<string, unknown>;
  try {
    decoded = jwt.verify(token, TWO_FACTOR_SECRET) as Record<string, unknown>;
  } catch {
    throw new UnauthorizedError('Invalid or expired two-factor challenge');
  }
  if (decoded.purpose !== 'two_factor' || typeof decoded.id !== 'string') {
    throw new UnauthorizedError('Invalid two-factor challenge');
  }
  return { id: decoded.id, purpose: 'two_factor' };
};
