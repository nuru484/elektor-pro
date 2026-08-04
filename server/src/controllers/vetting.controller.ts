// src/controllers/vetting.controller.ts
// Nomination vetting endpoints: criteria, scoring, decisions, ballot numbers.
import type { Request, RequestHandler, Response } from 'express';

import { type CandidateStatus } from '../../generated/prisma/client.js';
import { HTTP_STATUS_CODES } from '../config/constants.js';
import { asyncHandler } from '../middlewares/error-handler.js';
import validationMiddleware from '../middlewares/validation.js';
import {
  autoAssignBallotNumbers,
  type BallotNumberStrategy,
  createCriterion,
  decideCandidate,
  deleteCriterion,
  getCandidateVetting,
  listCriteria,
  scoreCandidate,
  setBallotNumber,
  updateCriterion,
} from '../services/domain/vetting.service.js';
import { requestContextOf } from '../utils/auth-session.js';
import { sendOk } from '../utils/http.js';
import {
  autoAssignSchema,
  ballotNumberSchema,
  candidateDecisionSchema,
  createCriterionSchema,
  updateCriterionSchema,
  vettingScoreSchema,
} from '../validations/domain-validation.js';
import { actorOf } from './proposal-response.js';

export const listCriteriaController = asyncHandler(
  async (req: Request, res: Response) => {
    sendOk(res, 'Criteria retrieved', await listCriteria(req.params.electionId));
  },
);

export const createCriterionController: RequestHandler[] = [
  ...validationMiddleware.create(createCriterionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await createCriterion(
      actorOf(req),
      req.params.electionId,
      req.body as { maxScore?: number; name: string },
      requestContextOf(req),
    );
    res.status(HTTP_STATUS_CODES.CREATED).json({
      data,
      message: 'Criterion created',
      success: true,
    });
  }),
];

export const updateCriterionController: RequestHandler[] = [
  ...validationMiddleware.update(updateCriterionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await updateCriterion(
      actorOf(req),
      req.params.criterionId,
      req.body as { name?: string },
      requestContextOf(req),
    );
    sendOk(res, 'Criterion updated', data);
  }),
];

export const deleteCriterionController = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteCriterion(actorOf(req), req.params.criterionId, requestContextOf(req));
    sendOk(res, 'Criterion deleted', { id: req.params.criterionId });
  },
);

export const getCandidateVettingController = asyncHandler(
  async (req: Request, res: Response) => {
    sendOk(res, 'Vetting retrieved', await getCandidateVetting(req.params.id));
  },
);

export const scoreCandidateController: RequestHandler[] = [
  ...validationMiddleware.create(vettingScoreSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await scoreCandidate(
      actorOf(req),
      req.params.id,
      req.body as { criterionId: string; note?: null | string; score: number },
      requestContextOf(req),
    );
    sendOk(res, 'Score recorded', data);
  }),
];

export const decideCandidateController: RequestHandler[] = [
  ...validationMiddleware.create(candidateDecisionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { note, status } = req.body as {
      note?: null | string;
      status: CandidateStatus;
    };
    const data = await decideCandidate(
      actorOf(req),
      req.params.id,
      status,
      note,
      requestContextOf(req),
    );
    sendOk(res, 'Decision recorded', data);
  }),
];

export const setBallotNumberController: RequestHandler[] = [
  ...validationMiddleware.update(ballotNumberSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await setBallotNumber(
      actorOf(req),
      req.params.id,
      (req.body as { ballotNumber: null | number }).ballotNumber,
      requestContextOf(req),
    );
    sendOk(res, 'Ballot number updated', data);
  }),
];

export const autoAssignBallotNumbersController: RequestHandler[] = [
  ...validationMiddleware.create(autoAssignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await autoAssignBallotNumbers(
      actorOf(req),
      req.params.electionId,
      (req.body as { strategy: BallotNumberStrategy }).strategy,
      requestContextOf(req),
    );
    sendOk(res, 'Ballot numbers assigned', data);
  }),
];
