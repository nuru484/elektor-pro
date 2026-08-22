// src/middlewares/optional-auth.ts
import type { NextFunction, Request, Response } from 'express';

import ENV from '../config/env.js';
import { verifyJwtToken } from '../utils/verify-jwt-token.js';

/**
 * Attach req.user if a valid access token is present, but never reject - used by
 * endpoints that are public but richer when authenticated (e.g. results).
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const token = cookies?.accessToken;
  if (token) {
    try {
      req.user = await verifyJwtToken(token, ENV.ACCESS_TOKEN_SECRET);
    } catch {
      // ignore - treat as anonymous
    }
  }
  next();
};
