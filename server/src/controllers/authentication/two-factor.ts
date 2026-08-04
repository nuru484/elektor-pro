// src/controllers/authentication/two-factor.ts
import type { Request, RequestHandler, Response } from 'express';

import {
  asyncHandler,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import validationMiddleware from '../../middlewares/validation.js';
import {
  activateEmailTwoFactor,
  activateTwoFactor,
  disableTwoFactor,
  regenerateRecoveryCodes,
  requestEmailTwoFactor,
  setupTwoFactor,
} from '../../services/auth/auth.service.js';
import { requestContextOf } from '../../utils/auth-session.js';
import {
  twoFactorActivateSchema,
  twoFactorDisableSchema,
} from '../../validations/auth-validation.js';

const userIdOf = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user.id;
};

export const setupTwoFactorController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await setupTwoFactor(userIdOf(req));
    res.status(200).json({
      data,
      message: 'Scan the QR code with your authenticator app',
      success: true,
    });
  },
);

const handleActivate = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  const data = await activateTwoFactor(userIdOf(req), code, requestContextOf(req));
  res.status(200).json({
    data,
    message: 'Two-factor authentication enabled. Save your recovery codes.',
    success: true,
  });
});

export const requestEmailTwoFactorController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await requestEmailTwoFactor(userIdOf(req));
    res.status(200).json({
      data,
      message: 'A confirmation code has been sent to your email',
      success: true,
    });
  },
);

const handleActivateEmail = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  const data = await activateEmailTwoFactor(userIdOf(req), code, requestContextOf(req));
  res.status(200).json({
    data,
    message: 'Two-factor authentication enabled. Save your recovery codes.',
    success: true,
  });
});

const handleRegenerateRecoveryCodes = asyncHandler(
  async (req: Request, res: Response) => {
    const { password } = req.body as { password: string };
    const data = await regenerateRecoveryCodes(
      userIdOf(req),
      password,
      requestContextOf(req),
    );
    res.status(200).json({
      data,
      message:
        'New recovery codes generated. Previous codes no longer work - save these.',
      success: true,
    });
  },
);

const handleDisable = asyncHandler(async (req: Request, res: Response) => {
  const { password } = req.body as { password: string };
  await disableTwoFactor(userIdOf(req), password, requestContextOf(req));
  res
    .status(200)
    .json({ message: 'Two-factor authentication disabled', success: true });
});

export const activateTwoFactorController: RequestHandler[] = [
  ...validationMiddleware.create(twoFactorActivateSchema),
  handleActivate,
];

export const activateEmailTwoFactorController: RequestHandler[] = [
  ...validationMiddleware.create(twoFactorActivateSchema),
  handleActivateEmail,
];

export const disableTwoFactorController: RequestHandler[] = [
  ...validationMiddleware.create(twoFactorDisableSchema),
  handleDisable,
];

// Password-confirmed like disable, hence the shared schema.
export const regenerateRecoveryCodesController: RequestHandler[] = [
  ...validationMiddleware.create(twoFactorDisableSchema),
  handleRegenerateRecoveryCodes,
];
