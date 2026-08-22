// src/controllers/domain.controller.ts
import type { Request, RequestHandler } from 'express';

import {
  type CandidateStatus,
  ChangeAction,
  ChangeEntity,
  type ChangeStatus,
  type ElectionStatus,
} from '../../generated/prisma/client.js';
import { ImportKind } from '../../generated/prisma/client.js';
import { cloudinaryService } from '../config/cloudinary.js';
import { HTTP_STATUS_CODES } from '../config/constants.js';
import multerUpload from '../config/multer.js';
import {
  asyncHandler,
  UnauthorizedError,
  ValidationError,
} from '../middlewares/error-handler.js';
import validationMiddleware from '../middlewares/validation.js';
import {
  approveChangeRequest,
  cancelChangeRequest,
  getChangeRequest,
  listChangeRequests,
  proposeOrExecute,
  rejectChangeRequest,
} from '../services/change-request/change-request.service.js';
import { previewCandidateImport } from '../services/domain/candidate-import.service.js';
import {
  allocateCandidates,
  getCandidate,
  listCandidates,
  listMyCandidacies,
} from '../services/domain/candidate.service.js';
import {
  getElection,
  listElections,
} from '../services/domain/election.service.js';
import {
  updateCandidateManifesto,
  updateCandidatePicture,
  updateVoterPicture,
} from '../services/domain/entity-picture.service.js';
import {
  getGroup,
  getGroupCategory,
  listGroupCategories,
  listGroups,
} from '../services/domain/group.service.js';
import {
  createImportBatch,
  getImportBatch,
} from '../services/domain/import-batch.service.js';
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
import { previewVoterImport } from '../services/domain/voter-import.service.js';
import { getVoter, listVoters } from '../services/domain/voter.service.js';
import { announceElectionOpened } from '../services/notifications/election-announcements.service.js';
import { dayBoundary } from '../utils/date-window.js';
import { parsePagination, sendList, sendOk } from '../utils/http.js';
import {
  allocateCandidatesSchema,
  bulkCandidateSchema,
  bulkVoterSchema,
  cloneElectionSchema,
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
import { runImportBatch } from '../workers/import.worker.js';
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
    from: dayBoundary(req.query.from),
    search: str(req.query.search),
    status: str(req.query.status) as ElectionStatus | undefined,
    to: dayBoundary(req.query.to, true),
  }),
  summary: (b) => `Create election: ${String(b.name)}`,
  updateSchema: updateElectionSchema,
});

export const updateElectionStatusController: RequestHandler[] = [
  ...validationMiddleware.update(electionStatusSchema),
  asyncHandler(async (req, res) => {
    const status = (req.body as { status: ElectionStatus }).status;
    const outcome = await proposeOrExecute(
      actorOf(req),
      {
        action: ChangeAction.UPDATE,
        entity: ChangeEntity.ELECTION,
        entityId: req.params.id,
        payload: { status },
        summary: `Set election status to ${status}`,
      },
      ctxOf(req),
    );
    // Announce openings after the commit; delivery never blocks the response.
    if (outcome.applied && status === 'IN_PROGRESS') {
      void announceElectionOpened(req.params.id);
    }
    respondToProposal(res, outcome, 'Election status');
  }),
];

/** Clone an election's structure into a fresh DRAFT with new dates. */
export const cloneElectionController: RequestHandler[] = [
  ...validationMiddleware.create(cloneElectionSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { endDate: Date; name: string; startDate: Date };
    const outcome = await proposeOrExecute(
      actorOf(req),
      {
        action: ChangeAction.CREATE,
        entity: ChangeEntity.ELECTION,
        payload: { ...body, cloneFromId: req.params.id },
        summary: `Clone election into "${body.name}"`,
      },
      ctxOf(req),
    );
    respondToProposal(res, outcome, 'Election', HTTP_STATUS_CODES.CREATED);
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
// Two optional files ride candidate creation (photo + manifesto PDF), so it
// uses a custom chain instead of the factory's single-image seam.
const uploadCandidateAssets = asyncHandler(async (req, _res, next) => {
  const files = req.files as
    | Partial<Record<string, Express.Multer.File[]>>
    | undefined;
  const body = req.body as Record<string, unknown>;
  const image = files?.image?.[0];
  const pdf = files?.manifestoPdf?.[0];
  if (image) {
    const uploaded = await cloudinaryService.uploadImage(
      { ...image },
      { folder: 'elektor-pro/candidates' },
    );
    body.profilePicture = uploaded.secure_url;
  }
  if (pdf) {
    if (pdf.mimetype !== 'application/pdf') {
      throw new ValidationError('Manifesto must be a PDF file', {
        code: 'VALIDATION_ERROR',
        context: { errors: [{ field: 'manifestoPdf', message: 'Manifesto must be a PDF file' }] },
      });
    }
    const uploaded = await cloudinaryService.uploadImage(
      { ...pdf },
      { folder: 'elektor-pro/manifestos', resource_type: 'auto' },
    );
    body.manifestoUrl = uploaded.secure_url;
  }
  next();
});

export const createCandidateController: RequestHandler[] = [
  multerUpload.fields([
    { maxCount: 1, name: 'image' },
    { maxCount: 1, name: 'manifestoPdf' },
  ]),
  ...validationMiddleware.create(createCandidateSchema),
  uploadCandidateAssets,
  asyncHandler(async (req, res) => {
    // The ballot shows faces: a photo is compulsory when nominating one
    // candidate. File imports stay photo-less by nature (spreadsheets can't
    // carry images) - the UI keeps reminding admins to add them after.
    if (!(req.body as { profilePicture?: string }).profilePicture) {
      throw new ValidationError('A candidate photo is required', {
        code: 'VALIDATION_ERROR',
        context: {
          errors: [{ field: 'image', message: 'A candidate photo is required' }],
        },
      });
    }
    const outcome = await proposeOrExecute(
      actorOf(req),
      {
        action: ChangeAction.CREATE,
        entity: ChangeEntity.CANDIDATE,
        payload: req.body,
        summary: `Create candidate: ${(req.body as { name: string }).name}`,
      },
      ctxOf(req),
    );
    respondToProposal(res, outcome, 'Candidate', HTTP_STATUS_CODES.CREATED);
  }),
];

export const candidateControllers = makeCrud({
  createSchema: createCandidateSchema,
  entity: ChangeEntity.CANDIDATE,
  get: getCandidate,
  label: 'Candidate',
  list: listCandidates,
  parseFilters: (req) => ({
    electionId: str(req.query.electionId),
    excludeElectionId: str(req.query.excludeElectionId),
    portfolioId: str(req.query.portfolioId),
    search: str(req.query.search),
    status: str(req.query.status) as CandidateStatus | undefined,
  }),
  summary: (b) => `Create candidate: ${String(b.name)}`,
  updateSchema: updateCandidateSchema,
});

/**
 * Parse + validate a CSV/XLSX nominations file for one election and report
 * per-row problems without writing anything; the client submits the valid
 * rows via POST /candidates/bulk. The election id rides the multipart body.
 */
export const previewCandidateImportController: RequestHandler[] = [
  multerUpload.single('file'),
  asyncHandler(async (req, res) => {
    const electionId = (req.body as { electionId?: string }).electionId;
    if (!req.file || !electionId) {
      throw new ValidationError('A file and an electionId are required', {
        code: 'VALIDATION_ERROR',
        context: {
          errors: [
            ...(req.file ? [] : [{ field: 'file', message: 'A CSV or XLSX file is required' }]),
            ...(electionId ? [] : [{ field: 'electionId', message: 'electionId is required' }]),
          ],
        },
      });
    }
    const data = await previewCandidateImport(electionId, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    sendOk(res, 'Import preview generated', data);
  }),
];

export const bulkUploadCandidatesController: RequestHandler[] = [
  ...validationMiddleware.create(bulkCandidateSchema),
  asyncHandler(async (req, res) => {
    const candidates = (req.body as { candidates: unknown[] }).candidates;
    const outcome = await proposeOrExecute(
      actorOf(req),
      {
        action: ChangeAction.CREATE,
        entity: ChangeEntity.CANDIDATE,
        payload: { candidates },
        summary: `Bulk nominate ${String(candidates.length)} candidates`,
      },
      ctxOf(req),
    );
    respondToProposal(res, outcome, 'Candidates', HTTP_STATUS_CODES.CREATED);
  }),
];

/** Allocate existing candidates (people) to a portfolio in this election. */
export const allocateCandidatesController: RequestHandler[] = [
  ...validationMiddleware.create(allocateCandidatesSchema),
  asyncHandler(async (req, res) => {
    const data = await allocateCandidates(
      actorOf(req),
      req.params.electionId,
      req.body as { candidateIds: string[]; portfolioId: string },
      ctxOf(req),
    );
    sendOk(res, 'Candidates allocated', data);
  }),
];

/** The signed-in candidate's own candidacies (candidate console home). */
export const myCandidaciesController = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const { data, meta } = await listMyCandidacies(
    req.user.id,
    {
      from: dayBoundary(req.query.from),
      search: str(req.query.search),
      to: dayBoundary(req.query.to, true),
    },
    parsePagination(req.query),
  );
  sendList(res, 'Candidacies retrieved', data, meta);
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
    excludeElectionId: str(req.query.excludeElectionId),
    groupId: str(req.query.groupId),
    search: str(req.query.search),
  }),
  summary: (b) => `Create voter: ${String(b.name)}`,
  updateSchema: updateVoterSchema,
});

/**
 * Parse + validate a CSV/XLSX voter file and report per-row problems without
 * writing anything; the client submits the valid rows via POST /voters/bulk.
 */
export const previewVoterImportController: RequestHandler[] = [
  multerUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('A CSV or XLSX file is required', {
        code: 'VALIDATION_ERROR',
        context: { errors: [{ field: 'file', message: 'A CSV or XLSX file is required' }] },
      });
    }
    const data = await previewVoterImport({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    sendOk(res, 'Import preview generated', data);
  }),
];

/**
 * Rows above this go through the chunked, resumable import path instead of a
 * single transaction. Below it the direct write is faster and keeps the
 * simpler maker-checker story, so small imports stay on that path.
 */
const ASYNC_IMPORT_THRESHOLD = 500;

export const bulkUploadVotersController: RequestHandler[] = [
  ...validationMiddleware.create(bulkVoterSchema),
  asyncHandler(async (req, res) => {
    const voters = (req.body as { voters: unknown[] }).voters;

    // A large register cannot be written in one transaction - it would be
    // held open for minutes and time out. Persist the rows as a batch and let
    // the worker commit them in chunks, so the admin gets an id to watch
    // rather than a request that hangs and then fails.
    if (voters.length > ASYNC_IMPORT_THRESHOLD) {
      const batch = await createImportBatch({
        actorId: actorOf(req).id,
        kind: ImportKind.VOTER,
        rows: voters,
      });
      const queued = await runImportBatch(batch.id);
      res.status(HTTP_STATUS_CODES.ACCEPTED).json({
        data: { ...batch, queued },
        message: queued
          ? `Importing ${String(voters.length)} voters in the background`
          : `Imported ${String(voters.length)} voters`,
        success: true,
      });
      return;
    }

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

/** Progress for a queued import, for the admin's progress view. */
export const importBatchController = asyncHandler(async (req, res) => {
  sendOk(res, 'Import status retrieved', await getImportBatch(req.params.id));
});

/** Standalone photo updates (binary can't ride maker-checker JSON). */
const requireImage = (req: Request): { buffer: Buffer; mimetype?: string } => {
  if (!req.file) {
    throw new ValidationError('An image file is required', {
      code: 'VALIDATION_ERROR',
      context: { errors: [{ field: 'image', message: 'An image file is required' }] },
    });
  }
  return { buffer: req.file.buffer, mimetype: req.file.mimetype };
};

export const updateVoterPictureController: RequestHandler[] = [
  multerUpload.single('image'),
  asyncHandler(async (req, res) => {
    const voter = await updateVoterPicture(
      req.params.id,
      requireImage(req),
      actorOf(req),
      ctxOf(req),
    );
    sendOk(res, 'Profile photo updated', voter);
  }),
];

export const updateCandidateManifestoController: RequestHandler[] = [
  multerUpload.single('manifestoPdf'),
  asyncHandler(async (req, res) => {
    if (req.file?.mimetype !== 'application/pdf') {
      throw new ValidationError('A PDF file is required', {
        code: 'VALIDATION_ERROR',
        context: { errors: [{ field: 'manifestoPdf', message: 'A PDF file is required' }] },
      });
    }
    const candidate = await updateCandidateManifesto(
      req.params.id,
      { buffer: req.file.buffer, mimetype: req.file.mimetype },
      actorOf(req),
      ctxOf(req),
    );
    sendOk(res, 'Manifesto updated', candidate);
  }),
];

export const updateCandidatePictureController: RequestHandler[] = [
  multerUpload.single('image'),
  asyncHandler(async (req, res) => {
    const candidate = await updateCandidatePicture(
      req.params.id,
      requireImage(req),
      actorOf(req),
      ctxOf(req),
    );
    sendOk(res, 'Profile photo updated', candidate);
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
