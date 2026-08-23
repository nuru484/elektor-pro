// src/routes/domain/index.ts
import { type RequestHandler, Router } from 'express';

import { Capability } from '../../../generated/prisma/client.js';
import {
  allocateCandidatesController,
  approveChangeRequestController,
  bulkUploadCandidatesController,
  bulkUploadVotersController,
  cancelChangeRequestController,
  candidateControllers,
  cloneElectionController,
  createCandidateController,
  electionControllers,
  getBrandingController,
  getChangeRequestController,
  getOrganizationController,
  groupCategoryControllers,
  groupControllers,
  importBatchController,
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
import {
  requireAnyCapability,
  requireCapability,
} from '../../middlewares/require-capability.js';

type Crud = ReturnType<typeof import('../../controllers/crud-factory.js').makeCrud>;

/**
 * Every capability that means "this person operates elections". Holding any
 * one of them is what makes the election catalog (elections, portfolios)
 * legitimately readable - an accreditor needs the election list to pick a
 * desk, an agent needs it to find their assignment, a vetting panelist needs
 * it to find their queue. Voters and candidates hold none of these and see
 * their own scoped endpoints instead.
 */
const ELECTION_OPERATIONS = [
  Capability.MANAGE_ELECTIONS,
  Capability.MANAGE_PORTFOLIOS,
  Capability.MANAGE_CANDIDATES,
  Capability.MANAGE_VOTERS,
  Capability.MANAGE_AGENTS,
  Capability.MANAGE_GROUPS,
  Capability.VET_CANDIDATES,
  Capability.ACCREDIT_VOTERS,
  Capability.VIEW_RESULTS,
  Capability.CERTIFY_RESULTS,
] as const;

/**
 * Reads are guarded as deliberately as writes. On bare `authenticateJWT`
 * any signed-in account - including a voter who had just logged in with an
 * SMS code - could page the entire voter register: names, phone numbers,
 * emails, and each person's per-election `hasVoted` flag. That is both a
 * data-protection breach and an integrity problem, since "who has not voted
 * yet" is exactly the list worth buying.
 */
const crudRouter = (
  controllers: Crud,
  capability: Capability,
  readCapabilities: readonly Capability[],
  overrides: { create?: RequestHandler[] } = {},
): Router => {
  const router = Router();
  const canRead = requireAnyCapability(readCapabilities);
  router.get('/', authenticateJWT, canRead, controllers.list);
  router.get('/:id', authenticateJWT, canRead, controllers.getOne);
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
// Public: the sign-in pages and the published results carry the organization's
// identity, and both are reached without a session.
domainRoutes.get('/branding', getBrandingController);
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
// Group pickers appear on the voter, election, and portfolio forms, so the
// read set is wider than MANAGE_GROUPS alone.
const GROUP_READERS = [
  Capability.MANAGE_GROUPS,
  Capability.MANAGE_VOTERS,
  Capability.MANAGE_ELECTIONS,
  Capability.MANAGE_PORTFOLIOS,
  Capability.MANAGE_CANDIDATES,
] as const;
domainRoutes.use(
  '/group-categories',
  crudRouter(groupCategoryControllers, Capability.MANAGE_GROUPS, GROUP_READERS),
);
domainRoutes.use(
  '/groups',
  crudRouter(groupControllers, Capability.MANAGE_GROUPS, GROUP_READERS),
);

// Voters (with bulk upload + standalone photo)
// The register is personal data. Only voter management and the accreditation
// desk may read it - notably NOT every signed-in account.
const votersRouter = crudRouter(voterControllers, Capability.MANAGE_VOTERS, [
  Capability.MANAGE_VOTERS,
  Capability.ACCREDIT_VOTERS,
]);
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
const electionsRouter = crudRouter(
  electionControllers,
  Capability.MANAGE_ELECTIONS,
  ELECTION_OPERATIONS,
);
electionsRouter.patch(
  '/:id/status',
  authenticateJWT,
  requireCapability(Capability.MANAGE_ELECTIONS),
  ...updateElectionStatusController,
);
electionsRouter.post(
  '/:id/clone',
  authenticateJWT,
  requireCapability(Capability.MANAGE_ELECTIONS),
  ...cloneElectionController,
);
domainRoutes.use('/elections', electionsRouter);

// Progress for a queued import. Same capability as creating one: whoever may
// import voters may watch the import they started.
domainRoutes.get(
  '/import-batches/:id',
  authenticateJWT,
  requireCapability(Capability.MANAGE_VOTERS),
  importBatchController,
);

// Portfolios & candidates
domainRoutes.use(
  '/portfolios',
  crudRouter(portfolioControllers, Capability.MANAGE_PORTFOLIOS, ELECTION_OPERATIONS),
);
const candidatesRouter = crudRouter(
  candidateControllers,
  Capability.MANAGE_CANDIDATES,
  [
    Capability.MANAGE_CANDIDATES,
    Capability.MANAGE_ELECTIONS,
    Capability.MANAGE_AGENTS,
    Capability.VET_CANDIDATES,
  ],
  { create: createCandidateController },
);
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

// Allocate existing candidates to a portfolio in this election.
domainRoutes.post(
  '/elections/:electionId/candidates/allocate',
  authenticateJWT,
  requireCapability(Capability.MANAGE_CANDIDATES, (req) => req.params.electionId),
  ...allocateCandidatesController,
);

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
