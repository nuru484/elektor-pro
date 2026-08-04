// src/controllers/roll.controller.ts
// Election roll management endpoints (list / add / eligibility / remove).
import type { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../middlewares/error-handler.js';
import validationMiddleware from '../middlewares/validation.js';
import {
  addToRoll,
  listRoll,
  removeFromRoll,
  setRollEligibility,
} from '../services/voting/roll.service.js';
import { requestContextOf } from '../utils/auth-session.js';
import { parsePagination, sendList, sendOk } from '../utils/http.js';
import {
  rollAddSchema,
  rollEligibilitySchema,
} from '../validations/voting-validation.js';
import { actorOf } from './proposal-response.js';

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const bool = (value: unknown): boolean | undefined =>
  value === 'true' ? true : value === 'false' ? false : undefined;

export const listRollController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listRoll(
      req.params.electionId,
      {
        accredited: bool(req.query.accredited),
        eligible: bool(req.query.eligible),
        search: str(req.query.search),
        voted: bool(req.query.voted),
      },
      parsePagination(req.query),
    );
    sendList(res, 'Roll retrieved', result.data, result.meta);
  },
);

export const addToRollController: RequestHandler[] = [
  ...validationMiddleware.create(rollAddSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await addToRoll(
      actorOf(req),
      req.params.electionId,
      req.body as { groupId?: string; joinGroupId?: string; voterIds?: string[] },
      requestContextOf(req),
    );
    sendOk(res, 'Roll updated', data);
  }),
];

export const setRollEligibilityController: RequestHandler[] = [
  ...validationMiddleware.update(rollEligibilitySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await setRollEligibility(
      actorOf(req),
      req.params.electionId,
      req.params.voterId,
      (req.body as { isEligible: boolean }).isEligible,
      requestContextOf(req),
    );
    sendOk(res, data.isEligible ? 'Voter marked eligible' : 'Voter excluded', data);
  }),
];

export const removeFromRollController = asyncHandler(
  async (req: Request, res: Response) => {
    await removeFromRoll(
      actorOf(req),
      req.params.electionId,
      req.params.voterId,
      requestContextOf(req),
    );
    sendOk(res, 'Voter removed from the roll', { voterId: req.params.voterId });
  },
);
