// src/controllers/authentication/demo-login.ts
import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../../middlewares/error-handler.js';
import validationMiddleware from '../../middlewares/validation.js';
import { getProfile } from '../../services/auth/auth.service.js';
import {
  type DemoRole,
  resolveDemoPrincipal,
} from '../../services/auth/demo-login.service.js';
import { issueSession } from '../../utils/auth-session.js';
import { demoLoginSchema } from '../../validations/auth-validation.js';

/**
 * One-click demo sign-in. The body names a role; the server picks the seeded
 * account. Two-factor is deliberately skipped - a demo fixture has no second
 * factor to present, and the account holds only demo data.
 */
const handleDemoLogin = asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.body as { role: DemoRole };
  const principal = await resolveDemoPrincipal(role);
  await issueSession(req, res, principal);
  const user = await getProfile(principal.id);
  res.status(200).json({
    data: user,
    message: `Signed in as the demo ${role.toLowerCase().replaceAll('_', ' ')}`,
    success: true,
  });
});

export const demoLogin: RequestHandler[] = [
  ...validationMiddleware.create(demoLoginSchema),
  handleDemoLogin,
];
