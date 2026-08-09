// src/middlewares/require-accreditation-desk.ts
import type { NextFunction, Request, Response } from 'express';

import { canAccreditElection } from '../services/governance/governance.service.js';
import { asyncHandler, ForbiddenError, UnauthorizedError } from './error-handler.js';

/**
 * Scope an accreditation endpoint to the desks the caller actually works.
 *
 * ACCREDIT_VOTERS says "this person can run an accreditation desk"; it does
 * not say WHICH. Without this check any accreditor could check voters in - or
 * read the register of - every election in the organization. Admins are not
 * assigned to elections and pass through.
 *
 * Always mount it AFTER `requireCapability(ACCREDIT_VOTERS)`, so the answer to
 * "may you accredit at all" is settled before we ask "may you accredit here".
 */
export const requireAccreditationDesk = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const electionId = req.params.electionId;
    const allowed = await canAccreditElection(
      { id: req.user.id, role: req.user.role },
      electionId,
    );
    if (!allowed) {
      throw new ForbiddenError(
        'You are not assigned to this election’s accreditation desk',
        { code: 'NOT_ASSIGNED_TO_ELECTION', context: { electionId } },
      );
    }
    next();
  },
);
