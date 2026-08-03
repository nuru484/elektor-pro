// src/controllers/authentication/logout.ts
import type { Request, Response } from 'express';

import { asyncHandler } from '../../middlewares/error-handler.js';
import { makeSessionService } from '../../services/auth/session.service.js';
import { defaultDeps } from '../../services/deps.js';
import { CookieManager } from '../../utils/CookieManager.js';
import { verifyRefreshToken } from '../../utils/jwt.js';

const sessions = makeSessionService(defaultDeps);

/**
 * Sign out: revoke the persisted session (best-effort - an already-invalid
 * token still clears the cookies) and clear both auth cookies.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshCookie = CookieManager.getCookie(req, 'refreshToken');
  if (refreshCookie) {
    try {
      const payload = verifyRefreshToken(refreshCookie);
      await sessions.revokeSession(payload.id, payload.sessionId);
    } catch {
      // Expired/invalid/foreign token - nothing to revoke.
    }
  }
  CookieManager.clearAllTokens(res);
  res.status(200).json({ message: 'Logged out successfully', success: true });
});
