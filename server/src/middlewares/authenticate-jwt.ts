// src/middlewares/authenticate-jwt.ts
import type { NextFunction, Request, Response } from 'express';

import jwt from 'jsonwebtoken';

import type { ITokenPayload } from '../types/auth.types.js';

import ENV from '../config/env.js';
import { CookieManager } from '../utils/CookieManager.js';
import { verifyJwtToken } from '../utils/verify-jwt-token.js';
import { asyncHandler, UnauthorizedError } from './error-handler.js';

const { JsonWebTokenError, TokenExpiredError } = jwt;

const authenticateJWT = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = CookieManager.getAccessToken(req);

  // Check if token exists
  if (!token) {
    throw new UnauthorizedError('Access token not found', {
      code: 'MISSING_TOKEN',
      context: { token },
      layer: 'jwt',
    });
  }

  try {
    const decodedUser = await verifyJwtToken(token, ENV.ACCESS_TOKEN_SECRET);

    req.user = decodedUser;

    next();
  } catch (tokenError) {
    if (tokenError instanceof TokenExpiredError) {
      console.log('Hello from here');
      throw new UnauthorizedError('Access token expired.', {
        code: 'EXPIRED_TOKEN',
        context: { token },
        layer: 'jwt',
      });
    }

    if (tokenError instanceof JsonWebTokenError) {
      throw new UnauthorizedError('Invalid access token. Please login again', {
        code: 'INVALID_TOKEN',
        context: { token },
        layer: 'jwt',
      });
    }

    throw tokenError;
  }
});

export default authenticateJWT;
