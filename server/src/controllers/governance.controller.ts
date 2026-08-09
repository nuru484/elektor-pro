// src/controllers/governance.controller.ts
import type { Request, RequestHandler, Response } from 'express';

import { type Capability, Role, type Status } from '../../generated/prisma/client.js';
import { HTTP_STATUS_CODES } from '../config/constants.js';
import multerUpload from '../config/multer.js';
import { asyncHandler, UnauthorizedError } from '../middlewares/error-handler.js';
import { handleCloudinaryUpload } from '../middlewares/handle-cloudinary-upload.js';
import validationMiddleware from '../middlewares/validation.js';
import {
  assignAccreditor,
  assignAgent,
  createStaffUser,
  grantCapability,
  listAccreditorAssignments,
  listAgentAssignments,
  listGrants,
  listMyAccreditationElections,
  listOpenElectionsForDesk,
  listStaffUsers,
  removeAccreditorAssignment,
  removeAgentAssignment,
  revokeGrant,
  type StaffUserInput,
} from '../services/governance/governance.service.js';
import { requestContextOf } from '../utils/auth-session.js';
import { dayBoundary } from '../utils/date-window.js';
import { parsePagination, sendCreated, sendList, sendOk } from '../utils/http.js';
import {
  assignAccreditorSchema,
  assignAgentSchema,
  createStaffUserSchema,
  grantSchema,
} from '../validations/governance-validation.js';
import { actorOf } from './proposal-response.js';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;

export const createStaffUserController: RequestHandler[] = [
  // Optional profile photo: multer parses the multipart body; the upload runs
  // AFTER validation so only the middleware's trusted URL reaches the input.
  multerUpload.single('image'),
  ...validationMiddleware.create(createStaffUserSchema),
  handleCloudinaryUpload({ folder: 'elektor-pro/profiles' }, 'profilePicture', true),
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

export const assignAccreditorController: RequestHandler[] = [
  ...validationMiddleware.create(assignAccreditorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await assignAccreditor(
      actorOf(req),
      req.body as { electionId: string; userId: string },
      requestContextOf(req),
    );
    res
      .status(HTTP_STATUS_CODES.CREATED)
      .json({ data, message: 'Accreditor assigned', success: true });
  }),
];

export const listAccreditorAssignmentsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listAccreditorAssignments(
      {
        electionId: str(req.query.electionId),
        search: str(req.query.search),
        userId: str(req.query.userId),
      },
      parsePagination(req.query),
    );
    sendList(res, 'Assignments retrieved', result.data, result.meta);
  },
);

export const removeAccreditorAssignmentController = asyncHandler(
  async (req: Request, res: Response) => {
    await removeAccreditorAssignment(
      actorOf(req),
      req.params.id,
      requestContextOf(req),
    );
    sendOk(res, 'Assignment removed', { id: req.params.id });
  },
);

/** The signed-in accreditor's own desks. */
export const myAccreditationElectionsController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const data =
      req.user.role === Role.SUPER_ADMIN || req.user.role === Role.ADMIN
        ? await listOpenElectionsForDesk()
        : await listMyAccreditationElections(req.user.id);
    sendOk(res, 'Elections retrieved', data);
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
