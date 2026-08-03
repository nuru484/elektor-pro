// src/controllers/authentication/login.ts
import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../middlewares/error-handler.js';
import validationMiddleware from '../../middlewares/validation.js';
import {
  authenticateStaff,
  getProfile,
  verifyStaffTwoFactor,
} from '../../services/auth/auth.service.js';
import { issueSession, requestContextOf } from '../../utils/auth-session.js';
import {
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
} from '../../utils/jwt.js';
import {
  loginSchema,
  twoFactorVerifySchema,
} from '../../validations/auth-validation.js';

const handleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { emailOrPhone, password } = req.body as {
    emailOrPhone: string;
    password: string;
  };
  const result = await authenticateStaff(
    emailOrPhone,
    password,
    requestContextOf(req),
  );

  if (result.status === 'two_factor_required') {
    res.status(200).json({
      data: {
        challengeToken: signTwoFactorChallenge(result.userId),
        method: result.method,
      },
      message:
        result.method === 'EMAIL'
          ? 'A sign-in code has been sent to your email'
          : 'Two-factor authentication required',
      requiresTwoFactor: true,
      success: true,
    });
    return;
  }

  await issueSession(req, res, { id: result.userId, role: result.role });
  const user = await getProfile(result.userId);
  res.status(200).json({ data: user, message: 'Login successful', success: true });
});

const handleVerifyTwoFactor = asyncHandler(
  async (req: Request, res: Response) => {
    const { challengeToken, code } = req.body as {
      challengeToken: string;
      code: string;
    };
    const { id } = verifyTwoFactorChallenge(challengeToken);
    const result = await verifyStaffTwoFactor(id, code, requestContextOf(req));
    await issueSession(req, res, { id: result.userId, role: result.role });
    const user = await getProfile(result.userId);
    res
      .status(200)
      .json({ data: user, message: 'Login successful', success: true });
  },
);

export const login: RequestHandler[] = [
  ...validationMiddleware.create(loginSchema),
  handleLogin,
];

export const verifyTwoFactorLogin: RequestHandler[] = [
  ...validationMiddleware.create(twoFactorVerifySchema),
  handleVerifyTwoFactor,
];
