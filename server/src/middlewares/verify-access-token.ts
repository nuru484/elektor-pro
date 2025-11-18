// src/middlewares/verify-access-token.ts
import type { Request, Response, NextFunction } from 'express';
import ENV from '../config/env.js';
import { verifyJwtToken } from '../utils/verify-jwt-token.js';
import { CookieManager } from '../utils/CookieManager.js';
import logger from '../utils/logger.js';

export const verifyAccessToken = async (req: Request, res: Response, next: NextFunction) => {
  const accessToken = CookieManager.getAccessToken(req);

  if (!accessToken) {
    return next();
  }

  try {
    const decoded = await verifyJwtToken(accessToken, ENV.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error(error);
    next();
  }
};
