// src/controllers/authentication/password.ts
import type { Request, RequestHandler, Response } from 'express';

import {
  asyncHandler,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import validationMiddleware from '../../middlewares/validation.js';
import {
  changePassword,
  requestPasswordReset,
  resetPassword,
} from '../../services/auth/auth.service.js';
import { requestContextOf } from '../../utils/auth-session.js';
import { CookieManager } from '../../utils/CookieManager.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../validations/auth-validation.js';

const handleChangePassword = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    await changePassword(
      req.user.id,
      currentPassword,
      newPassword,
      requestContextOf(req),
    );
    CookieManager.clearAllTokens(res);
    res.status(200).json({
      message: 'Password changed successfully. Please log in again.',
      success: true,
    });
  },
);

const handleForgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { emailOrPhone } = req.body as { emailOrPhone: string };
    await requestPasswordReset(emailOrPhone);
    // Always 200 to avoid account enumeration.
    res.status(200).json({
      message: 'If an account exists, a reset link has been sent.',
      success: true,
    });
  },
);

const handleResetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { newPassword, token } = req.body as {
      newPassword: string;
      token: string;
    };
    await resetPassword(token, newPassword, requestContextOf(req));
    res.status(200).json({ message: 'Password reset successfully', success: true });
  },
);

export const changePasswordController: RequestHandler[] = [
  ...validationMiddleware.create(changePasswordSchema),
  handleChangePassword,
];

export const forgotPasswordController: RequestHandler[] = [
  ...validationMiddleware.create(forgotPasswordSchema),
  handleForgotPassword,
];

export const resetPasswordController: RequestHandler[] = [
  ...validationMiddleware.create(resetPasswordSchema),
  handleResetPassword,
];
