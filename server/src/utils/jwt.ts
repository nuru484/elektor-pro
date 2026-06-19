// src/utils/jwt.ts
import jwt, { type SignOptions } from 'jsonwebtoken';

import ENV from '../config/env.js';
import type { Role } from '../../generated/prisma/client.js';

export interface AccessPayload {
  id: string;
  role: Role;
}

export interface TwoFactorChallengePayload {
  id: string;
  purpose: 'two_factor';
}

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
    ENV.ACCESS_TOKEN_SECRET,
    { expiresIn: '5m' },
  );

export const verifyAccessToken = (token: string): AccessPayload =>
  jwt.verify(token, ENV.ACCESS_TOKEN_SECRET) as AccessPayload;

export const verifyTwoFactorChallenge = (
  token: string,
): TwoFactorChallengePayload =>
  jwt.verify(token, ENV.ACCESS_TOKEN_SECRET) as TwoFactorChallengePayload;
