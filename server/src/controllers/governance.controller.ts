// src/controllers/governance.controller.ts
import type { Request, RequestHandler, Response } from 'express';

import { type Capability, type Role, type Status } from '../../generated/prisma/client.js';
import { HTTP_STATUS_CODES } from '../config/constants.js';
import { asyncHandler } from '../middlewares/error-handler.js';
import validationMiddleware from '../middlewares/validation.js';
import {
  assignAgent,
  createStaffUser,
  grantCapability,
  listAgentAssignments,
  listGrants,
  listStaffUsers,
  removeAgentAssignment,
  revokeGrant,
  type StaffUserInput,
} from '../services/governance/governance.service.js';
import { requestContextOf } from '../utils/auth-session.js';
import { dayBoundary } from '../utils/date-window.js';
import { parsePagination, sendCreated, sendList, sendOk } from '../utils/http.js';
import {
  assignAgentSchema,
  createStaffUserSchema,
  grantSchema,
} from '../validations/governance-validation.js';
import { actorOf } from './proposal-response.js';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;

export const createStaffUserController: RequestHandler[] = [
  ...validationMiddleware.create(createStaffUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await createStaffUser(
      actorOf(req),
      req.body as StaffUserInput,
      requestContextOf(req),
    );
    sendCreated(res, 'Account created', data);
  }),
];

export const listStaffUsersController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listStaffUsers(
      {
        from: dayBoundary(req.query.from),
        role: str(req.query.role) as Role | undefined,
        search: str(req.query.search),
        status: str(req.query.status) as Status | undefined,
        to: dayBoundary(req.query.to, true),
      },
      parsePagination(req.query),
    );
    sendList(res, 'Users retrieved', result.data, result.meta);
  },
);

export const assignAgentController: RequestHandler[] = [
  ...validationMiddleware.create(assignAgentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await assignAgent(
      actorOf(req),
      req.body as { candidateId?: string; electionId: string; userId: string },
      requestContextOf(req),
    );
    res.status(HTTP_STATUS_CODES.CREATED).json({ data, message: 'Agent assigned', success: true });
  }),
];

export const listAgentAssignmentsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listAgentAssignments(
      {
        electionId: str(req.query.electionId),
        from: dayBoundary(req.query.from),
        search: str(req.query.search),
        to: dayBoundary(req.query.to, true),
      },
      parsePagination(req.query),
    );
    sendList(res, 'Assignments retrieved', result.data, result.meta);
  },
);

export const removeAgentAssignmentController = asyncHandler(
  async (req: Request, res: Response) => {
    await removeAgentAssignment(actorOf(req), req.params.id);
    sendOk(res, 'Assignment removed', { id: req.params.id });
  },
);

export const grantController: RequestHandler[] = [
  ...validationMiddleware.create(grantSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await grantCapability(
      actorOf(req),
      req.body as { capability: Capability; electionId?: string; expiresAt?: Date; userId: string },
      requestContextOf(req),
    );
    sendCreated(res, 'Capability granted', data);
  }),
];

export const listGrantsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listGrants(
      {
        capability: str(req.query.capability) as Capability | undefined,
        electionId: str(req.query.electionId),
        from: dayBoundary(req.query.from),
        to: dayBoundary(req.query.to, true),
        userId: str(req.query.userId),
      },
      parsePagination(req.query),
    );
    sendList(res, 'Grants retrieved', result.data, result.meta);
  },
);

export const revokeGrantController = asyncHandler(
  async (req: Request, res: Response) => {
    await revokeGrant(actorOf(req), req.params.id);
    sendOk(res, 'Grant revoked', { id: req.params.id });
  },
);
