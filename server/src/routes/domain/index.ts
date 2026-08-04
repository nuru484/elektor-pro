// src/routes/domain/index.ts
import { Router } from 'express';

import { Capability } from '../../../generated/prisma/client.js';
import {
  approveChangeRequestController,
  bulkUploadVotersController,
  cancelChangeRequestController,
  candidateControllers,
  electionControllers,
  getChangeRequestController,
  getOrganizationController,
  groupCategoryControllers,
  groupControllers,
  listChangeRequestsController,
  portfolioControllers,
  rejectChangeRequestController,
  updateElectionStatusController,
  updateOrganizationController,
  updateOrganizationFaviconController,
  updateOrganizationLogoController,
  voterControllers,
} from '../../controllers/domain.controller.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { requireCapability } from '../../middlewares/require-capability.js';

type Crud = ReturnType<typeof import('../../controllers/crud-factory.js').makeCrud>;

const crudRouter = (controllers: Crud, capability: Capability): Router => {
  const router = Router();
  router.get('/', authenticateJWT, controllers.list);
  router.get('/:id', authenticateJWT, controllers.getOne);
  router.post('/', authenticateJWT, requireCapability(capability), ...controllers.create);
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

// Voters (with bulk upload)
const votersRouter = crudRouter(voterControllers, Capability.MANAGE_VOTERS);
votersRouter.post(
  '/bulk',
  authenticateJWT,
  requireCapability(Capability.MANAGE_VOTERS),
  ...bulkUploadVotersController,
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
domainRoutes.use(
  '/candidates',
  crudRouter(candidateControllers, Capability.MANAGE_CANDIDATES),
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
