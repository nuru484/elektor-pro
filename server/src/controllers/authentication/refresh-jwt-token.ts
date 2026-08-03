// src/controllers/authentication/refresh-jwt-token.ts
import type { Request, Response } from 'express';

import jwt from 'jsonwebtoken';

import {
  asyncHandler,
  NotFoundError,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import { getProfile } from '../../services/auth/auth.service.js';
import { makeSessionService } from '../../services/auth/session.service.js';
import { defaultDeps } from '../../services/deps.js';
import { setSessionCookies } from '../../utils/auth-session.js';
import { CookieManager } from '../../utils/CookieManager.js';

const sessions = makeSessionService(defaultDeps);

/**
 * Exchange the refresh cookie for a fresh token pair, rotating the persisted
 * session. A stale/reused token revokes the whole session (see the session
 * service) so a stolen refresh token cannot be replayed.
 */
export const refreshToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const currentRefreshToken = CookieManager.getRefreshToken(req);

    let rotated;
    try {
      rotated = await sessions.rotateSession(currentRefreshToken);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expired. Please log in again.', {
          layer: 'refreshToken',
        });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token', {
          layer: 'refreshToken',
        });
      }
      throw error;
    }

    const user = await getProfile(rotated.userId);
    if (!user) throw new NotFoundError('Invalid credentials');

    setSessionCookies(res, rotated);
    res.status(200).json({
      data: user,
      message: 'Token refreshed successfully',
      success: true,
    });
  },
);
