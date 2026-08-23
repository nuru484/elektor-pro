// src/utils/auth-session.ts
import type { Request, Response } from 'express';

import type { Role } from '../../generated/prisma/client.js';

import { makeSessionService } from '../services/auth/session.service.js';
import { defaultDeps } from '../services/deps.js';
import { CookieManager } from './CookieManager.js';

const sessions = makeSessionService(defaultDeps);

/**
 * Start a persisted session for a fresh login and set the token pair as
 * http-only cookies. Every login path (staff password, 2FA completion, voter
 * OTP) goes through here so a device always shows up on the sessions page.
 */
export const issueSession = async (
  req: Request,
  res: Response,
  user: { id: string; role: Role },
): Promise<void> => {
  const issued = await sessions.createSession(user, requestContextOf(req));
  CookieManager.clearAllTokens(res);
  CookieManager.setAccessToken(res, issued.accessToken);
  CookieManager.setRefreshToken(res, issued.refreshToken);
};

/** Set an already-rotated token pair (the refresh path). */
export const setSessionCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void => {
  CookieManager.clearAllTokens(res);
  CookieManager.setAccessToken(res, tokens.accessToken);
  CookieManager.setRefreshToken(res, tokens.refreshToken);
};

/**
 * Replace only the access cookie, leaving the refresh cookie as it stands.
 *
 * Used by the refresh path when this request lost a rotation race: the winner
 * has already put its refresh token in the browser and that is the one the
 * session row holds. Writing a second one here would leave the browser
 * carrying a token the row has demoted, and the next refresh - half an hour
 * later, long past the rotation grace - would read it as theft and revoke the
 * session. The caller still needs to get on with its request, hence the fresh
 * access token.
 */
export const setAccessCookieOnly = (res: Response, accessToken: string): void => {
  CookieManager.setAccessToken(res, accessToken);
};

export const requestContextOf = (
  req: Request,
): { ipAddress?: string; userAgent?: string } => ({
  ipAddress: req.ip,
  userAgent: req.get('user-agent') ?? undefined,
});
