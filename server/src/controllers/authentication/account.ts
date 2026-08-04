// src/controllers/authentication/account.ts
import type { Request, Response } from 'express';

import {
  asyncHandler,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import { getProfile, unlockAccount } from '../../services/auth/auth.service.js';
import { requestContextOf } from '../../utils/auth-session.js';

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const user = await getProfile(req.user.id);
  res.status(200).json({ data: user, message: 'Profile retrieved', success: true });
});

export const unlockUserAccount = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { userId } = req.params as { userId: string };
    await unlockAccount(
      { id: req.user.id, role: req.user.role },
      userId,
      requestContextOf(req),
    );
    res.status(200).json({ message: 'Account unlocked', success: true });
  },
);
