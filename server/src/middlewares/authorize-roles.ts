// src/middlewares/authorize-roles.ts
import type { NextFunction, Request, Response } from 'express';

import { Role } from '../../generated/prisma/client.js';
import { ForbiddenError } from './error-handler.js';

export const authorizeRole =
  (allowedRoles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ForbiddenError('Unauthorized: User not authenticated');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError();
    }
    next();
  };
