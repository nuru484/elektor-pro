// src/routes/authentication/index.ts
import { Router } from 'express';

import {
  activateTwoFactorController,
  changePasswordController,
  disableTwoFactorController,
  forgotPasswordController,
  login,
  logout,
  me,
  refreshToken,
  resetPasswordController,
  setupTwoFactorController,
  unlockUserAccount,
  verifyTwoFactorLogin,
} from '../../controllers/authentication/index.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../../middlewares/authorize-roles.js';
import {
  authRateLimiter,
  passwordResetLimiter,
} from '../../middlewares/rateLimit.js';
import { Role } from '../../../generated/prisma/client.js';

const authRoutes = Router();

// Public
authRoutes.post('/login', authRateLimiter, ...login);
authRoutes.post('/2fa/verify', authRateLimiter, ...verifyTwoFactorLogin);
authRoutes.post('/refresh', refreshToken);
authRoutes.post('/logout', logout);
authRoutes.post(
  '/password/forgot',
  passwordResetLimiter,
  ...forgotPasswordController,
);
authRoutes.post(
  '/password/reset',
  passwordResetLimiter,
  ...resetPasswordController,
);

// Authenticated
authRoutes.get('/me', authenticateJWT, me);
authRoutes.post('/password/change', authenticateJWT, ...changePasswordController);
authRoutes.post('/2fa/setup', authenticateJWT, setupTwoFactorController);
authRoutes.post('/2fa/activate', authenticateJWT, ...activateTwoFactorController);
authRoutes.post('/2fa/disable', authenticateJWT, ...disableTwoFactorController);

// Super-admin only
authRoutes.post(
  '/users/:userId/unlock',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  unlockUserAccount,
);

export default authRoutes;
