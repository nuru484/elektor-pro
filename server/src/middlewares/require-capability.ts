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

/**
 * Guard a route by ANY ONE of several capabilities - the read counterpart of
 * requireCapability. Catalog reads are consumed by more roles than the single
 * capability that governs writing them: the accreditation desk needs the
 * election list, the voter form needs groups, the vetting panel needs
 * candidates. Listing the acceptable capabilities keeps those reads open to
 * exactly the people who operate the election, and closed to everyone else.
 */
export const requireAnyCapability = (capabilities: readonly Capability[]) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    const actor = { id: req.user.id, role: req.user.role };
    for (const capability of capabilities) {
      if (await hasCapability(actor, capability)) {
        next();
        return;
      }
    }
    throw new ForbiddenError('You are not allowed to view this resource', {
      code: 'MISSING_CAPABILITY',
      context: { anyOf: capabilities },
    });
  });
