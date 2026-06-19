// src/controllers/authentication/refresh-jwt-token.ts
import type { Request, Response } from 'express';

import jwt from 'jsonwebtoken';

import type { AccessPayload } from '../../utils/jwt.js';

import ENV from '../../config/env.js';
import {
  asyncHandler,
  NotFoundError,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import { getProfile } from '../../services/auth/auth.service.js';
import { issueSession } from '../../utils/auth-session.js';
import { CookieManager } from '../../utils/CookieManager.js';
import { verifyJwtToken } from '../../utils/verify-jwt-token.js';

export const refreshToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const currentRefreshToken = CookieManager.getRefreshToken(req);

    let decoded: AccessPayload;
    try {
      decoded = await verifyJwtToken<AccessPayload>(
        currentRefreshToken,
        ENV.REFRESH_TOKEN_SECRET,
      );
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError(
          'Refresh token expired. Please log in again.',
          { layer: 'refreshToken' },
        );
      }
      throw new UnauthorizedError('Invalid refresh token', {
        layer: 'refreshToken',
      });
    }

    const user = await getProfile(decoded.id);
    if (!user) throw new NotFoundError('Invalid credentials');

    issueSession(res, { id: user.id, role: user.role });
    res.status(200).json({
      data: user,
      message: 'Token refreshed successfully',
      success: true,
    });
  },
);
