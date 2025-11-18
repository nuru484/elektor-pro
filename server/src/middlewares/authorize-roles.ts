// src/middlewares/authorize-roles.ts
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler, ForbiddenError } from './error-handler.js';
import { Role } from '../../generated/prisma/index.js';

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
    if (!allowedRoles.includes(req.user.role as Role)) {
      throw new ForbiddenError();
    }

    // User is authorized
    next();
  });
