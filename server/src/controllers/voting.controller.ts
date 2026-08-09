// src/controllers/voting.controller.ts
import type { Request, RequestHandler, Response } from 'express';

import { Role } from '../../generated/prisma/client.js';
import { Capability } from '../../generated/prisma/client.js';
import { HTTP_STATUS_CODES } from '../config/constants.js';
import prisma from '../lib/prisma.js';
import { asyncHandler, UnauthorizedError } from '../middlewares/error-handler.js';
import { ForbiddenError } from '../middlewares/error-handler.js';
import validationMiddleware from '../middlewares/validation.js';
import { hasCapability } from '../services/authorization/capability.service.js';
import { canAccreditElection } from '../services/governance/governance.service.js';
import {
  accreditVoter,
  getTurnout,
  getVoterHistory,
  listVoterElections,
  revokeAccreditation,
  searchVotersForAccreditation,
  verifyVoteCode,
} from '../services/voting/accreditation.service.js';
import {
  requestVoterOtp,
  verifyVoterOtp,
} from '../services/voting/voter-auth.service.js';
import {
  type BallotSelection,
  castBallot,
  getVoterBallot,
  verifyBallotChain,
  verifyReceipt,
} from '../services/voting/voting.service.js';
import { issueSession, requestContextOf } from '../utils/auth-session.js';
import { dayBoundary } from '../utils/date-window.js';
import { parsePagination, sendList, sendOk } from '../utils/http.js';
import {
  castBallotSchema,
  codeLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
} from '../validations/voting-validation.js';
import { actorOf } from './proposal-response.js';

const voterId = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user.id;
};

/** Shared search + period filters for the voter's personal lists. */
const voterListFilters = (req: Request) => ({
  from: dayBoundary(req.query.from),
  search: typeof req.query.search === 'string' ? req.query.search : undefined,
  to: dayBoundary(req.query.to, true),
});

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
    await issueSession(req, res, { id: result.userId, role: Role.VOTER });
    sendOk(res, 'Logged in', { voterId: result.voterId });
  }),
];

export const listVoterElectionsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { data, meta } = await listVoterElections(
      voterId(req),
      voterListFilters(req),
      parsePagination(req.query),
    );
    sendList(res, 'Elections retrieved', data, meta);
  },
);

export const voterHistoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const { data, meta } = await getVoterHistory(
      voterId(req),
      voterListFilters(req),
      parsePagination(req.query),
    );
    sendList(res, 'History retrieved', data, meta);
  },
);

export const getBallotController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getVoterBallot(voterId(req), req.params.electionId);
    sendOk(res, 'Ballot retrieved', data);
  },
);

export const castBallotController: RequestHandler[] = [
  ...validationMiddleware.create(castBallotSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { selections } = req.body as { selections: BallotSelection[] };
    const result = await castBallot(
      voterId(req),
      req.params.electionId,
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
      req.params.electionId,
      req.params.code,
    );
    sendOk(res, 'Receipt verified', data);
  },
);

export const verifyBallotChainController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await verifyBallotChain(req.params.electionId);
    sendOk(res, 'Ballot chain verified', data);
  },
);

export const accreditVoterController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await accreditVoter(
      actorOf(req),
      req.params.electionId,
      req.params.voterId,
      requestContextOf(req),
    );
    sendOk(res, 'Voter accredited', data);
  },
);

export const searchAccreditationController = asyncHandler(
  async (req: Request, res: Response) => {
    // Short/empty queries fall back to the election's eligible register
    // inside the service, so the desk always has voters on screen.
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const data = await searchVotersForAccreditation(req.params.electionId, query);
    sendOk(res, 'Voters retrieved', data);
  },
);

export const revokeAccreditationController = asyncHandler(
  async (req: Request, res: Response) => {
    await revokeAccreditation(
      actorOf(req),
      req.params.electionId,
      req.params.voterId,
      requestContextOf(req),
    );
    sendOk(res, 'Accreditation revoked', { voterId: req.params.voterId });
  },
);

/**
 * Live turnout. Visible to admins, agents assigned to the election, and
 * holders of ACCREDIT_VOTERS or VIEW_RESULTS (scoped grants included).
 */
export const getTurnoutController = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) throw new UnauthorizedError('Authentication required');
    const electionId = req.params.electionId;
    const isStaff = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    const isAssignedAgent =
      user.role === Role.AGENT &&
      (await prisma.agentAssignment.findFirst({
        select: { id: true },
        where: { electionId, userId: user.id },
      })) !== null;
    // An accreditor's ACCREDIT_VOTERS only counts for elections they are
    // actually assigned to - otherwise turnout would leak the whole
    // organization's numbers to any desk operator.
    const isAssignedAccreditor =
      (await hasCapability(user, Capability.ACCREDIT_VOTERS, electionId)) &&
      (await canAccreditElection(user, electionId));
    const allowed =
      isStaff ||
      isAssignedAgent ||
      isAssignedAccreditor ||
      (await hasCapability(user, Capability.VIEW_RESULTS, electionId));
    if (!allowed) {
      throw new ForbiddenError('Turnout is not available to you');
    }
    sendOk(res, 'Turnout retrieved', await getTurnout(electionId));
  },
);

export const codeLoginController: RequestHandler[] = [
  ...validationMiddleware.create(codeLoginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { code, voterId } = req.body as { code: string; voterId: string };
    const result = await verifyVoteCode(voterId, code);
    await issueSession(req, res, { id: result.userId, role: Role.VOTER });
    sendOk(res, 'Logged in', { voterId: result.voterId });
  }),
];
