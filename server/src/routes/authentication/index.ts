// src/routes/authentication/index.ts
import { Router } from 'express';

import { Role } from '../../../generated/prisma/client.js';
import {
  activateEmailTwoFactorController,
  activateTwoFactorController,
  changePasswordController,
  confirmEmailChangeController,
  confirmPhoneChangeController,
  demoLogin,
  disableTwoFactorController,
  forgotPasswordController,
  listSessionsController,
  login,
  logout,
  me,
  refreshToken,
  regenerateRecoveryCodesController,
  requestEmailChangeController,
  requestEmailTwoFactorController,
  requestPhoneChangeController,
  resetPasswordController,
  revokeOtherSessionsController,
  revokeSessionController,
  setupTwoFactorController,
  unlockUserAccount,
  updateProfileController,
  updateProfilePictureController,
  verifyTwoFactorLogin,
} from '../../controllers/authentication/index.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../../middlewares/authorize-roles.js';
import {
  authRateLimiter,
  demoLoginLimiter,
  passwordResetLimiter,
} from '../../middlewares/rateLimit.js';

const authRoutes = Router();

// Public
authRoutes.post('/login', authRateLimiter, ...login);
authRoutes.post('/2fa/verify', authRateLimiter, ...verifyTwoFactorLogin);
// Portfolio demo sign-in: no credentials, the server picks the seeded account.
authRoutes.post('/demo-login', demoLoginLimiter, ...demoLogin);
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

// Profile self-service (all roles)
authRoutes.patch('/profile', authenticateJWT, ...updateProfileController);
authRoutes.patch('/profile/picture', authenticateJWT, ...updateProfilePictureController);
authRoutes.post('/profile/email/request', authenticateJWT, ...requestEmailChangeController);
authRoutes.post('/profile/email/confirm', authenticateJWT, ...confirmEmailChangeController);
authRoutes.post('/profile/phone/request', authenticateJWT, ...requestPhoneChangeController);
authRoutes.post('/profile/phone/confirm', authenticateJWT, ...confirmPhoneChangeController);

// Sessions (signed-in devices)
authRoutes.get('/sessions', authenticateJWT, listSessionsController);
authRoutes.delete('/sessions/others', authenticateJWT, revokeOtherSessionsController);
authRoutes.delete('/sessions/:sessionId', authenticateJWT, revokeSessionController);

// Two-factor enrollment
authRoutes.post('/2fa/setup', authenticateJWT, setupTwoFactorController);
authRoutes.post('/2fa/activate', authenticateJWT, ...activateTwoFactorController);
authRoutes.post('/2fa/email/request', authenticateJWT, requestEmailTwoFactorController);
authRoutes.post('/2fa/email/activate', authenticateJWT, ...activateEmailTwoFactorController);
authRoutes.post('/2fa/disable', authenticateJWT, ...disableTwoFactorController);
authRoutes.post(
  '/2fa/recovery-codes',
  authenticateJWT,
  ...regenerateRecoveryCodesController,
);

// Super-admin only
authRoutes.post(
  '/users/:userId/unlock',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  unlockUserAccount,
);

export default authRoutes;
