// src/middlewares/require-capability.ts
import type { NextFunction, Request, Response } from 'express';

import type { Capability } from '../../generated/prisma/client.js';

import { hasCapability } from '../services/authorization/capability.service.js';
import { asyncHandler, ForbiddenError, UnauthorizedError } from './error-handler.js';

/**
 * Guard a route by capability. Optionally scope the check to an election id
 * resolved from the request (params/body/query).
 */
export const requireCapability = (
  capability: Capability,
  resolveElectionId?: (req: Request) => string | undefined,
) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    const electionId = resolveElectionId?.(req);
    const allowed = await hasCapability(
      { id: req.user.id, role: req.user.role },
      capability,
      electionId,
    );
    if (!allowed) {
      throw new ForbiddenError(
        `Missing capability: ${capability}`,
        { code: 'MISSING_CAPABILITY', context: { capability } },
      );
    }
    next();
  });
