// src/routes/results/index.ts
import { Router } from 'express';

import { Capability } from '../../../generated/prisma/client.js';
import {
  certifyResultsController,
  downloadExportController,
  exportJobStatusController,
  exportResultsController,
  getCertificationController,
  getElectionReportController,
  getResultsController,
  publishResultsController,
  requestResultsExportController,
  unpublishResultsController,
} from '../../controllers/results.controller.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { optionalAuth } from '../../middlewares/optional-auth.js';
import { requireCapability } from '../../middlewares/require-capability.js';

const resultsRoutes = Router();

// Public-aware reads (visibility enforced inside the controller).
resultsRoutes.get('/elections/:electionId/results', optionalAuth, getResultsController);
resultsRoutes.get(
  '/elections/:electionId/results/export',
  optionalAuth,
  exportResultsController,
);
// Background export: ask, poll, then collect. The synchronous endpoint above
// stays for small elections and for deployments without a queue.
resultsRoutes.post(
  '/elections/:electionId/results/export',
  optionalAuth,
  requestResultsExportController,
);
resultsRoutes.get(
  '/elections/:electionId/results/export/:jobId',
  optionalAuth,
  exportJobStatusController,
);
// Collected by token, not by session: the link has to survive being handed to
// a browser download. The token is unguessable, expiring, and revocable.
resultsRoutes.get('/exports/:token', downloadExportController);

resultsRoutes.get(
  '/elections/:electionId/certification',
  optionalAuth,
  getCertificationController,
);

resultsRoutes.get(
  '/elections/:electionId/report',
  authenticateJWT,
  getElectionReportController,
);

// Privileged actions
resultsRoutes.post(
  '/elections/:electionId/results/publish',
  authenticateJWT,
  requireCapability(Capability.CERTIFY_RESULTS),
  publishResultsController,
);
resultsRoutes.post(
  '/elections/:electionId/results/unpublish',
  authenticateJWT,
  requireCapability(Capability.CERTIFY_RESULTS),
  unpublishResultsController,
);
resultsRoutes.post(
  '/elections/:electionId/results/certify',
  authenticateJWT,
  requireCapability(Capability.CERTIFY_RESULTS),
  certifyResultsController,
);

export default resultsRoutes;
