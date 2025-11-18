// src/controllers/authentication/refreshJwtToken.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import ENV from '../../config/env.js';
import { verifyJwtToken } from '../../utils/verify-jwt-token.js';
import { CustomError, UnauthorizedError, asyncHandler, NotFoundError } from '../../middlewares/error-handler.js';
import type { ITokenPayload } from '../../types/auth.types.js';
import { CookieManager } from '../../utils/CookieManager.js';
import prisma from '../../config/prismaClient.js';

export const refreshToken: (req: Request, res: Response, next: NextFunction) => Promise<void> = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const currentRefreshToken = CookieManager.getRefreshToken(req);

    if (!currentRefreshToken) {
      throw new UnauthorizedError('Unauthorised, no refresh token provided', {
        layer: 'refreshToken',
      });
    }

    // Verify token and decode user
    let decodedUser: ITokenPayload;
    try {
      decodedUser = await verifyJwtToken<ITokenPayload>(currentRefreshToken, ENV.REFRESH_TOKEN_SECRET);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Unauthorised, refresh token expired. Please log in again.', {
          layer: 'refreshToken',
        });
      }
      throw new CustomError(401, 'Invalid refresh token');
    }

    // Generate new refresh token
    const newRefreshToken = jwt.sign({ id: decodedUser.id, role: decodedUser.role }, ENV.REFRESH_TOKEN_SECRET, {
      expiresIn: '7d',
    });

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        id: decodedUser.id,
        role: decodedUser.role,
      },
      ENV.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' },
    );

    CookieManager.clearAllTokens(res);
    CookieManager.setAccessToken(res, newAccessToken);
    CookieManager.setRefreshToken(res, newRefreshToken);

    const user = await prisma.user.findUnique({
      where: { id: decodedUser.id },
    });

    if (!user) {
      throw new NotFoundError('Invalid credentials');
    }

    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: userWithoutPassword,
    });
  },
);
