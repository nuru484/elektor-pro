// src/controllers/authentication/two-factor.ts
import type { Request, RequestHandler, Response } from 'express';

import {
  asyncHandler,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import validationMiddleware from '../../middlewares/validation.js';
import {
  activateTwoFactor,
  disableTwoFactor,
  setupTwoFactor,
} from '../../services/auth/auth.service.js';
import { requestContextOf } from '../../utils/auth-session.js';
import {
  twoFactorActivateSchema,
  twoFactorDisableSchema,
} from '../../validations/auth-validation.js';

export const setupTwoFactorController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const data = await setupTwoFactor(req.user.id);
    res.status(200).json({
      data,
      message: 'Scan the QR code with your authenticator app',
      success: true,
    });
  },
);

const handleActivate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const { code } = req.body as { code: string };
  const data = await activateTwoFactor(req.user.id, code, requestContextOf(req));
  res.status(200).json({
    data,
    message: 'Two-factor authentication enabled. Save your recovery codes.',
    success: true,
  });
});

const handleDisable = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const { password } = req.body as { password: string };
  await disableTwoFactor(req.user.id, password, requestContextOf(req));
  res
    .status(200)
    .json({ message: 'Two-factor authentication disabled', success: true });
});

export const activateTwoFactorController: RequestHandler[] = [
  ...validationMiddleware.create(twoFactorActivateSchema),
  handleActivate,
];

export const disableTwoFactorController: RequestHandler[] = [
  ...validationMiddleware.create(twoFactorDisableSchema),
  handleDisable,
];
