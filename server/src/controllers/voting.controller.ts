// src/controllers/voting.controller.ts
import type { Request, RequestHandler, Response } from 'express';

import { Role } from '../../generated/prisma/client.js';
import { HTTP_STATUS_CODES } from '../config/constants.js';
import { asyncHandler, UnauthorizedError } from '../middlewares/error-handler.js';
import validationMiddleware from '../middlewares/validation.js';
import {
  accreditVoter,
  listVoterElections,
} from '../services/voting/accreditation.service.js';
import {
  requestVoterOtp,
  verifyVoterOtp,
} from '../services/voting/voter-auth.service.js';
import {
  type BallotSelection,
  castBallot,
  getVoterBallot,
  verifyReceipt,
} from '../services/voting/voting.service.js';
import { issueSession, requestContextOf } from '../utils/auth-session.js';
import { sendOk } from '../utils/http.js';
import {
  castBallotSchema,
  otpRequestSchema,
  otpVerifySchema,
} from '../validations/voting-validation.js';
import { actorOf } from './proposal-response.js';

const voterId = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user.id;
};

export const requestOtpController: RequestHandler[] = [
  ...validationMiddleware.create(otpRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await requestVoterOtp((req.body as { identifier: string }).identifier);
    sendOk(res, 'Verification code sent', data);
  }),
];

export const verifyOtpController: RequestHandler[] = [
  ...validationMiddleware.create(otpVerifySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { code, identifier } = req.body as { code: string; identifier: string };
    const result = await verifyVoterOtp(identifier, code, requestContextOf(req));
    issueSession(res, { id: result.userId, role: Role.VOTER });
    sendOk(res, 'Logged in', { voterId: result.voterId });
  }),
];

export const listVoterElectionsController = asyncHandler(
  async (req: Request, res: Response) => {
    sendOk(res, 'Elections retrieved', await listVoterElections(voterId(req)));
  },
);

export const getBallotController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getVoterBallot(voterId(req), req.params['electionId'] ?? '');
    sendOk(res, 'Ballot retrieved', data);
  },
);

export const castBallotController: RequestHandler[] = [
  ...validationMiddleware.create(castBallotSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { selections } = req.body as { selections: BallotSelection[] };
    const result = await castBallot(
      voterId(req),
      req.params['electionId'] ?? '',
      selections,
    );
    res.status(HTTP_STATUS_CODES.CREATED).json({
      data: result,
      message: 'Your vote has been recorded. Keep your receipt code safe.',
      success: true,
    });
  }),
];

export const verifyReceiptController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await verifyReceipt(
      req.params['electionId'] ?? '',
      req.params['code'] ?? '',
    );
    sendOk(res, 'Receipt verified', data);
  },
);

export const accreditVoterController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await accreditVoter(
      actorOf(req),
      req.params['electionId'] ?? '',
      req.params['voterId'] ?? '',
      requestContextOf(req),
    );
    sendOk(res, 'Voter accredited', data);
  },
);
