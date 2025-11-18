// src/controllers/authentication/logout.ts
import type { Request, Response } from 'express';
import { CookieManager } from '../../utils/CookieManager.js';

export const logout = (req: Request, res: Response): void => {
  CookieManager.clearAllTokens(res);
  res.status(200).json({ message: 'Logged out successfully' });
};

