// src/middlewares/authenticate-jwt.ts
import type { NextFunction, Request, Response } from 'express';

import jwt from 'jsonwebtoken';

import ENV from '../config/env.js';
import { mustChangePassword } from '../services/auth/password-gate.service.js';
import { CookieManager } from '../utils/CookieManager.js';
import { verifyJwtToken } from '../utils/verify-jwt-token.js';
import { asyncHandler, ForbiddenError, UnauthorizedError } from './error-handler.js';

const { JsonWebTokenError, TokenExpiredError } = jwt;

// The only authenticated endpoints reachable while a forced password change is
// pending: the change itself, and /auth/me so the client can identify the user
// and route them to the change screen. Everything else answers 403.
const PASSWORD_GATE_EXEMPT_PATHS = new Set([
  '/api/v1/auth/me',
  '/api/v1/auth/password/change',
]);

const authenticateJWT = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = CookieManager.getAccessToken(req);

  if (!token) {
    throw new UnauthorizedError('Access token not found', {
      code: 'MISSING_TOKEN',
      layer: 'jwt',
    });
  }

  let userId: string;
  try {
    const decodedUser = await verifyJwtToken(token, ENV.ACCESS_TOKEN_SECRET);

    req.user = decodedUser;
    userId = decodedUser.id;
  } catch (tokenError) {
    // NB: never attach the raw token to the error context - it would end up
    // in logs / the error tracker. The message + code are enough to debug.
    if (tokenError instanceof TokenExpiredError) {
      throw new UnauthorizedError('Access token expired.', {
        code: 'EXPIRED_TOKEN',
        layer: 'jwt',
      });
    }

    if (tokenError instanceof JsonWebTokenError) {
      throw new UnauthorizedError('Invalid access token. Please login again', {
        code: 'INVALID_TOKEN',
        layer: 'jwt',
      });
    }

    throw tokenError;
  }

  // Enforce the forced first-login password change server-side; the client
  // routing to /password-setup is UX, this is the actual gate.
  const path = req.originalUrl.split('?')[0];
  if (!PASSWORD_GATE_EXEMPT_PATHS.has(path) && (await mustChangePassword(userId))) {
    throw new ForbiddenError('You must change your password before continuing', {
      code: 'PASSWORD_CHANGE_REQUIRED',
      layer: 'auth',
    });
  }

  next();
});

export default authenticateJWT;
