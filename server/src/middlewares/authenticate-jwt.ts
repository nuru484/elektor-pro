// src/middlewares/authenticate-jwt.ts
import type { Request, Response, NextFunction } from 'express';
import ENV from '../config/env.js';
import { asyncHandler, UnauthorizedError } from './error-handler.js';
import { verifyJwtToken } from '../utils/verify-jwt-token.js';
import { CookieManager } from '../utils/CookieManager.js';
import type { ITokenPayload } from '../types/auth.types.js';
import jwt from 'jsonwebtoken';

const { TokenExpiredError, JsonWebTokenError } = jwt;

const authenticateJWT = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = CookieManager.getAccessToken(req);

  // Check if token exists
  if (!token) {
    throw new UnauthorizedError('Access token not found', {
      layer: 'jwt',
      code: 'MISSING_TOKEN',
      context: { token },
    });
  }

  try {
    const decodedUser = await verifyJwtToken<ITokenPayload>(token, ENV.ACCESS_TOKEN_SECRET);

    req.user = decodedUser;

    next();
  } catch (tokenError) {
    if (tokenError instanceof TokenExpiredError) {
      console.log('Hello from here');
      throw new UnauthorizedError('Access token expired.', {
        layer: 'jwt',
        code: 'EXPIRED_TOKEN',
        context: { token },
      });
    }

    if (tokenError instanceof JsonWebTokenError) {
      throw new UnauthorizedError('Invalid access token. Please login again', {
        layer: 'jwt',
        code: 'INVALID_TOKEN',
        context: { token },
      });
    }

    throw tokenError;
  }
});

export default authenticateJWT;
