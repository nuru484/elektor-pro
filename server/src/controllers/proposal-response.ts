// src/controllers/proposal-response.ts
import type { Request, Response } from 'express';

import type { ChangeActor } from '../services/change-request/types.js';

import { HTTP_STATUS_CODES } from '../config/constants.js';
import { UnauthorizedError } from '../middlewares/error-handler.js';
import { requestContextOf } from '../utils/auth-session.js';

type ProposalOutcome =
  | { applied: false; changeRequest: { id: string; status: string } }
  | { applied: true; result: { id: string } };

/** Pull the authenticated actor (id + role) off the request. */
export const actorOf = (req: Request): ChangeActor => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return { id: req.user.id, role: req.user.role };
};

export const ctxOf = requestContextOf;

/**
 * Respond to a maker-checker outcome: 200/201 when applied directly
 * (super-admin), 202 Accepted when staged for approval (admin).
 */
export const respondToProposal = (
  res: Response,
  outcome: ProposalOutcome,
  label: string,
  appliedStatus: number = HTTP_STATUS_CODES.OK,
): void => {
  if (outcome.applied) {
    res.status(appliedStatus).json({
      data: outcome.result,
      message: `${label} saved`,
      success: true,
    });
    return;
  }
  res.status(202).json({
    data: outcome.changeRequest,
    message: `${label} change submitted for super-admin approval`,
    pending: true,
    success: true,
  });
};
