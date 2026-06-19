// src/utils/auth-session.ts
import type { Request, Response } from 'express';

import { CookieManager } from './CookieManager.js';
import { signAccessToken, signRefreshToken, type AccessPayload } from './jwt.js';

/** Sign access + refresh tokens and set them as http-only cookies. */
export const issueSession = (res: Response, payload: AccessPayload): void => {
  CookieManager.clearAllTokens(res);
  CookieManager.setAccessToken(res, signAccessToken(payload));
  CookieManager.setRefreshToken(res, signRefreshToken(payload));
};

export const requestContextOf = (
  req: Request,
): { ipAddress?: string; userAgent?: string } => ({
  ipAddress: req.ip,
  userAgent: req.get('user-agent') ?? undefined,
});
