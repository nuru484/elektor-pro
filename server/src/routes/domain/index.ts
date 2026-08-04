// src/routes/domain/index.ts
import { type RequestHandler, Router } from 'express';

import { Capability } from '../../../generated/prisma/client.js';
import {
  approveChangeRequestController,
  bulkUploadCandidatesController,
  bulkUploadVotersController,
  cancelChangeRequestController,
  candidateControllers,
  createCandidateController,
  electionControllers,
  getChangeRequestController,
  getOrganizationController,
  groupCategoryControllers,
  groupControllers,
  listChangeRequestsController,
  myCandidaciesController,
  portfolioControllers,
  previewCandidateImportController,
  previewVoterImportController,
  rejectChangeRequestController,
  updateCandidateManifestoController,
  updateCandidatePictureController,
  updateElectionStatusController,
  updateOrganizationController,
  updateOrganizationFaviconController,
  updateOrganizationLogoController,
  updateVoterPictureController,
  voterControllers,
} from '../../controllers/domain.controller.js';
import {
  autoAssignBallotNumbersController,
  createCriterionController,
  decideCandidateController,
  deleteCriterionController,
  getCandidateVettingController,
  listCriteriaController,
  scoreCandidateController,
  setBallotNumberController,
  updateCriterionController,
} from '../../controllers/vetting.controller.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { requireCapability } from '../../middlewares/require-capability.js';

type Crud = ReturnType<typeof import('../../controllers/crud-factory.js').makeCrud>;

const crudRouter = (
  controllers: Crud,
  capability: Capability,
  overrides: { create?: RequestHandler[] } = {},
): Router => {
  const router = Router();
  router.get('/', authenticateJWT, controllers.list);
  router.get('/:id', authenticateJWT, controllers.getOne);
  router.post(
    '/',
    authenticateJWT,
    requireCapability(capability),
    ...(overrides.create ?? controllers.create),
  );
  router.patch('/:id', authenticateJWT, requireCapability(capability), ...controllers.update);
  router.delete('/:id', authenticateJWT, requireCapability(capability), controllers.remove);
  return router;
};

const domainRoutes = Router();

// Organization (singleton)
domainRoutes.get('/organization', authenticateJWT, getOrganizationController);
domainRoutes.patch(
  '/organization',
  authenticateJWT,
  requireCapability(Capability.MANAGE_ORGANIZATION),
  ...updateOrganizationController,
);
domainRoutes.patch(
  '/organization/logo',
  authenticateJWT,
  requireCapability(Capability.MANAGE_ORGANIZATION),
  ...updateOrganizationLogoController,
);
domainRoutes.patch(
  '/organization/favicon',
  authenticateJWT,
  requireCapability(Capability.MANAGE_ORGANIZATION),
  ...updateOrganizationFaviconController,
);

// Groups & categories
domainRoutes.use(
  '/group-categories',
  crudRouter(groupCategoryControllers, Capability.MANAGE_GROUPS),
);
domainRoutes.use('/groups', crudRouter(groupControllers, Capability.MANAGE_GROUPS));

// Voters (with bulk upload + standalone photo)
const votersRouter = crudRouter(voterControllers, Capability.MANAGE_VOTERS);
votersRouter.post(
  '/bulk',
  authenticateJWT,
  requireCapability(Capability.MANAGE_VOTERS),
  ...bulkUploadVotersController,
);
votersRouter.post(
  '/import/preview',
  authenticateJWT,
  requireCapability(Capability.MANAGE_VOTERS),
  ...previewVoterImportController,
);
votersRouter.patch(
  '/:id/picture',
  authenticateJWT,
  requireCapability(Capability.MANAGE_VOTERS),
  ...updateVoterPictureController,
);
domainRoutes.use('/voters', votersRouter);

// Elections (with status transition)
const electionsRouter = crudRouter(electionControllers, Capability.MANAGE_ELECTIONS);
electionsRouter.patch(
  '/:id/status',
  authenticateJWT,
  requireCapability(Capability.MANAGE_ELECTIONS),
  ...updateElectionStatusController,
);
domainRoutes.use('/elections', electionsRouter);

// Portfolios & candidates
domainRoutes.use(
  '/portfolios',
  crudRouter(portfolioControllers, Capability.MANAGE_PORTFOLIOS),
);
const candidatesRouter = crudRouter(candidateControllers, Capability.MANAGE_CANDIDATES, {
  create: createCandidateController,
});
candidatesRouter.post(
  '/bulk',
  authenticateJWT,
  requireCapability(Capability.MANAGE_CANDIDATES),
  ...bulkUploadCandidatesController,
);
candidatesRouter.post(
  '/import/preview',
  authenticateJWT,
  requireCapability(Capability.MANAGE_CANDIDATES),
  ...previewCandidateImportController,
);
candidatesRouter.patch(
  '/:id/picture',
  authenticateJWT,
  requireCapability(Capability.MANAGE_CANDIDATES),
  ...updateCandidatePictureController,
);
candidatesRouter.patch(
  '/:id/manifesto',
  authenticateJWT,
  requireCapability(Capability.MANAGE_CANDIDATES),
  ...updateCandidateManifestoController,
);
candidatesRouter.get('/:id/vetting', authenticateJWT, getCandidateVettingController);
candidatesRouter.put(
  '/:id/vetting/score',
  authenticateJWT,
  requireCapability(Capability.VET_CANDIDATES),
  ...scoreCandidateController,
);
candidatesRouter.post(
  '/:id/status',
  authenticateJWT,
  requireCapability(Capability.VET_CANDIDATES),
  ...decideCandidateController,
);
candidatesRouter.patch(
  '/:id/ballot-number',
  authenticateJWT,
  requireCapability(Capability.MANAGE_CANDIDATES),
  ...setBallotNumberController,
);
domainRoutes.use('/candidates', candidatesRouter);

// The signed-in candidate's own candidacies (no capability: it is scoped to
// the caller's linked account and returns nothing for everyone else).
domainRoutes.get('/my/candidacies', authenticateJWT, myCandidaciesController);

// Vetting criteria + ballot-number auto-assignment (election-scoped)
domainRoutes.get(
  '/elections/:electionId/vetting/criteria',
  authenticateJWT,
  requireCapability(Capability.VET_CANDIDATES, (req) => req.params.electionId),
  listCriteriaController,
);
domainRoutes.post(
  '/elections/:electionId/vetting/criteria',
  authenticateJWT,
  requireCapability(Capability.VET_CANDIDATES),
  ...createCriterionController,
);
domainRoutes.patch(
  '/vetting/criteria/:criterionId',
  authenticateJWT,
  requireCapability(Capability.VET_CANDIDATES),
  ...updateCriterionController,
);
domainRoutes.delete(
  '/vetting/criteria/:criterionId',
  authenticateJWT,
  requireCapability(Capability.VET_CANDIDATES),
  deleteCriterionController,
);
domainRoutes.post(
  '/elections/:electionId/ballot-numbers/auto',
  authenticateJWT,
  requireCapability(Capability.MANAGE_CANDIDATES),
  ...autoAssignBallotNumbersController,
);

// Change requests (maker-checker queue)
domainRoutes.get('/change-requests', authenticateJWT, listChangeRequestsController);
domainRoutes.get('/change-requests/:id', authenticateJWT, getChangeRequestController);
domainRoutes.post(
  '/change-requests/:id/approve',
  authenticateJWT,
  requireCapability(Capability.APPROVE_CHANGES),
  ...approveChangeRequestController,
);
domainRoutes.post(
  '/change-requests/:id/reject',
  authenticateJWT,
  requireCapability(Capability.APPROVE_CHANGES),
  ...rejectChangeRequestController,
);
domainRoutes.post(
  '/change-requests/:id/cancel',
  authenticateJWT,
  cancelChangeRequestController,
);

export default domainRoutes;
