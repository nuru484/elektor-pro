// src/middlewares/authorize-roles.ts
import type { NextFunction, Request, Response } from 'express';

import { Role } from '../../generated/prisma/client.js';
import { asyncHandler, ForbiddenError } from './error-handler.js';

export const authorizeRole = (allowedRoles: Role[]) =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Verify user object exists
    if (!req.user) {
      throw new ForbiddenError('Unauthorized: User not authenticated');
    }

    // Verify role exists
    if (!req.user.role) {
      throw new ForbiddenError('Unauthorized: User role not defined');
    }

    // Check if user has required role
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError();
    }

    // User is authorized
    next();
  });
