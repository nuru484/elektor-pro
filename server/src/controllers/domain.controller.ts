// src/controllers/domain.controller.ts
import type { Request, RequestHandler } from 'express';

import {
  ChangeAction,
  ChangeEntity,
  type ChangeStatus,
  type ElectionStatus,
} from '../../generated/prisma/client.js';
import { HTTP_STATUS_CODES } from '../config/constants.js';
import multerUpload from '../config/multer.js';
import { asyncHandler, ValidationError } from '../middlewares/error-handler.js';
import validationMiddleware from '../middlewares/validation.js';
import {
  approveChangeRequest,
  cancelChangeRequest,
  getChangeRequest,
  listChangeRequests,
  proposeOrExecute,
  rejectChangeRequest,
} from '../services/change-request/change-request.service.js';
import {
  getCandidate,
  listCandidates,
} from '../services/domain/candidate.service.js';
import {
  getElection,
  listElections,
} from '../services/domain/election.service.js';
import {
  getGroup,
  getGroupCategory,
  listGroupCategories,
  listGroups,
} from '../services/domain/group.service.js';
import {
  type BrandingField,
  updateBrandingImage,
} from '../services/domain/organization-branding.service.js';
import {
  getOrganization,
} from '../services/domain/organization.service.js';
import {
  getPortfolio,
  listPortfolios,
} from '../services/domain/portfolio.service.js';
import { getVoter, listVoters } from '../services/domain/voter.service.js';
import { dayBoundary } from '../utils/date-window.js';
import { parsePagination, sendList, sendOk } from '../utils/http.js';
import {
  bulkVoterSchema,
  createCandidateSchema,
  createElectionSchema,
  createGroupCategorySchema,
  createGroupSchema,
  createPortfolioSchema,
  createVoterSchema,
  electionStatusSchema,
  reviewChangeSchema,
  updateCandidateSchema,
  updateElectionSchema,
  updateGroupCategorySchema,
  updateGroupSchema,
  updateOrganizationSchema,
  updatePortfolioSchema,
  updateVoterSchema,
} from '../validations/domain-validation.js';
import { makeCrud } from './crud-factory.js';
import { actorOf, ctxOf, respondToProposal } from './proposal-response.js';

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

// --- Elections ---
export const electionControllers = makeCrud({
  createSchema: createElectionSchema,
  entity: ChangeEntity.ELECTION,
  get: getElection,
  label: 'Election',
  list: listElections,
  parseFilters: (req) => ({
    search: str(req.query.search),
    status: str(req.query.status) as ElectionStatus | undefined,
  }),
  summary: (b) => `Create election: ${String(b.name)}`,
  updateSchema: updateElectionSchema,
});

export const updateElectionStatusController: RequestHandler[] = [
  ...validationMiddleware.update(electionStatusSchema),
  asyncHandler(async (req, res) => {
    const outcome = await proposeOrExecute(
      actorOf(req),
      {
        action: ChangeAction.UPDATE,
        entity: ChangeEntity.ELECTION,
        entityId: req.params.id,
        payload: { status: (req.body as { status: ElectionStatus }).status },
        summary: `Set election status to ${(req.body as { status: string }).status}`,
      },
      ctxOf(req),
    );
    respondToProposal(res, outcome, 'Election status');
  }),
];

// --- Portfolios ---
export const portfolioControllers = makeCrud({
  createSchema: createPortfolioSchema,
  entity: ChangeEntity.PORTFOLIO,
  get: getPortfolio,
  label: 'Portfolio',
  list: listPortfolios,
  parseFilters: (req) => ({ electionId: str(req.query.electionId) }),
  summary: (b) => `Create portfolio: ${String(b.name)}`,
  updateSchema: updatePortfolioSchema,
});

// --- Candidates ---
export const candidateControllers = makeCrud({
  createImage: { field: 'profilePicture', folder: 'elektor-pro/candidates' },
  createSchema: createCandidateSchema,
  entity: ChangeEntity.CANDIDATE,
  get: getCandidate,
  label: 'Candidate',
  list: listCandidates,
  parseFilters: (req) => ({
    electionId: str(req.query.electionId),
    portfolioId: str(req.query.portfolioId),
    search: str(req.query.search),
  }),
  summary: (b) => `Create candidate: ${String(b.name)}`,
  updateSchema: updateCandidateSchema,
});

// --- Voters ---
export const voterControllers = makeCrud({
  createImage: { field: 'profilePicture', folder: 'elektor-pro/voters' },
  createSchema: createVoterSchema,
  entity: ChangeEntity.VOTER,
  get: getVoter,
  label: 'Voter',
  list: listVoters,
  parseFilters: (req) => ({
    groupId: str(req.query.groupId),
    search: str(req.query.search),
  }),
  summary: (b) => `Create voter: ${String(b.name)}`,
  updateSchema: updateVoterSchema,
});

export const bulkUploadVotersController: RequestHandler[] = [
  ...validationMiddleware.create(bulkVoterSchema),
  asyncHandler(async (req, res) => {
    const voters = (req.body as { voters: unknown[] }).voters;
    const outcome = await proposeOrExecute(
      actorOf(req),
      {
        action: ChangeAction.CREATE,
        entity: ChangeEntity.VOTER,
        payload: { voters },
        summary: `Bulk upload ${voters.length} voters`,
      },
      ctxOf(req),
    );
    respondToProposal(res, outcome, 'Voters', HTTP_STATUS_CODES.CREATED);
  }),
];

// --- Groups & categories ---
export const groupCategoryControllers = makeCrud({
  createSchema: createGroupCategorySchema,
  entity: ChangeEntity.GROUP_CATEGORY,
  get: getGroupCategory,
  label: 'Group category',
  list: listGroupCategories,
  parseFilters: (req) => ({ search: str(req.query.search) }),
  summary: (b) => `Create group category: ${String(b.name)}`,
  updateSchema: updateGroupCategorySchema,
});

export const groupControllers = makeCrud({
  createSchema: createGroupSchema,
  entity: ChangeEntity.GROUP,
  get: getGroup,
  label: 'Group',
  list: listGroups,
  parseFilters: (req) => ({
    categoryId: str(req.query.categoryId),
    search: str(req.query.search),
  }),
  summary: (b) => `Create group: ${String(b.name)}`,
  updateSchema: updateGroupSchema,
});

// --- Organization (singleton) ---
export const getOrganizationController = asyncHandler(async (_req, res) => {
  sendOk(res, 'Organization retrieved', await getOrganization());
});

/** Branding images apply directly (binary can't ride maker-checker JSON). */
const brandingHandler = (field: BrandingField, message: string) =>
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('An image file is required', {
        code: 'VALIDATION_ERROR',
        context: { errors: [{ field: 'image', message: 'An image file is required' }] },
      });
    }
    const org = await updateBrandingImage(
      field,
      { buffer: req.file.buffer, mimetype: req.file.mimetype },
      actorOf(req),
      ctxOf(req),
    );
    sendOk(res, message, org);
  });

export const updateOrganizationLogoController: RequestHandler[] = [
  multerUpload.single('image'),
  brandingHandler('logoUrl', 'Logo updated'),
];

export const updateOrganizationFaviconController: RequestHandler[] = [
  multerUpload.single('image'),
  brandingHandler('faviconUrl', 'Favicon updated'),
];

export const updateOrganizationController: RequestHandler[] = [
  ...validationMiddleware.update(updateOrganizationSchema),
  asyncHandler(async (req, res) => {
    const org = await getOrganization();
    const outcome = await proposeOrExecute(
      actorOf(req),
      {
        action: ChangeAction.UPDATE,
        entity: ChangeEntity.ORGANIZATION,
        entityId: org.id,
        payload: req.body,
        summary: 'Update organization settings',
      },
      ctxOf(req),
    );
    respondToProposal(res, outcome, 'Organization');
  }),
];

// --- Change requests (maker-checker queue) ---
export const listChangeRequestsController = asyncHandler(async (req, res) => {
  const result = await listChangeRequests(
    {
      entity: str(req.query.entity) as ChangeEntity | undefined,
      from: dayBoundary(req.query.from),
      requestedById:
        req.query.mine === 'true' ? req.user?.id : str(req.query.requestedById),
      search: str(req.query.search),
      status: str(req.query.status) as ChangeStatus | undefined,
      to: dayBoundary(req.query.to, true),
    },
    parsePagination(req.query),
  );
  sendList(res, 'Change requests retrieved', result.data, result.meta);
});

export const getChangeRequestController = asyncHandler(async (req, res) => {
  sendOk(res, 'Change request retrieved', await getChangeRequest(req.params.id));
});

export const approveChangeRequestController: RequestHandler[] = [
  ...validationMiddleware.update(reviewChangeSchema),
  asyncHandler(async (req, res) => {
    const result = await approveChangeRequest(
      actorOf(req),
      req.params.id,
      (req.body as { note?: string }).note,
      ctxOf(req),
    );
    res.status(HTTP_STATUS_CODES.OK).json({
      data: result,
      message: 'Change request approved and applied',
      success: true,
    });
  }),
];

export const rejectChangeRequestController: RequestHandler[] = [
  ...validationMiddleware.update(reviewChangeSchema),
  asyncHandler(async (req, res) => {
    await rejectChangeRequest(
      actorOf(req),
      req.params.id,
      (req.body as { note?: string }).note,
      ctxOf(req),
    );
    sendOk(res, 'Change request rejected', { id: req.params.id });
  }),
];

export const cancelChangeRequestController = asyncHandler(
  async (req: Request, res) => {
    await cancelChangeRequest(actorOf(req), req.params.id);
    sendOk(res, 'Change request cancelled', { id: req.params.id });
  },
);
