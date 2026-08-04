// src/routes/results/index.ts
import { Router } from 'express';

import { Capability } from '../../../generated/prisma/client.js';
import {
  certifyResultsController,
  exportResultsController,
  getCertificationController,
  getResultsController,
  publishResultsController,
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
resultsRoutes.get(
  '/elections/:electionId/certification',
  optionalAuth,
  getCertificationController,
);

// Privileged actions
resultsRoutes.post(
  '/elections/:electionId/results/publish',
  authenticateJWT,
  requireCapability(Capability.CERTIFY_RESULTS),
  publishResultsController,
);
resultsRoutes.post(
  '/elections/:electionId/results/certify',
  authenticateJWT,
  requireCapability(Capability.CERTIFY_RESULTS),
  certifyResultsController,
);

export default resultsRoutes;
