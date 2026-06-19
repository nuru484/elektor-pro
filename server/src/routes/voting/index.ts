// src/routes/voting/index.ts
import { Router } from 'express';

import {
  accreditVoterController,
  castBallotController,
  getBallotController,
  listVoterElectionsController,
  requestOtpController,
  verifyOtpController,
  verifyReceiptController,
} from '../../controllers/voting.controller.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../../middlewares/authorize-roles.js';
import { requireCapability } from '../../middlewares/require-capability.js';
import { authRateLimiter } from '../../middlewares/rateLimit.js';
import { Capability, Role } from '../../../generated/prisma/client.js';

const votingRoutes = Router();

// Voter authentication (phone OTP)
votingRoutes.post('/voter/otp/request', authRateLimiter, ...requestOtpController);
votingRoutes.post('/voter/otp/verify', authRateLimiter, ...verifyOtpController);

// Voter ballot flow (role VOTER)
votingRoutes.get(
  '/voter/elections',
  authenticateJWT,
  authorizeRole([Role.VOTER]),
  listVoterElectionsController,
);
votingRoutes.get(
  '/voter/elections/:electionId/ballot',
  authenticateJWT,
  authorizeRole([Role.VOTER]),
  getBallotController,
);
votingRoutes.post(
  '/voter/elections/:electionId/ballot',
  authenticateJWT,
  authorizeRole([Role.VOTER]),
  ...castBallotController,
);

// Public receipt verification
votingRoutes.get('/elections/:electionId/receipts/:code', verifyReceiptController);

// Accreditation (staff with capability)
votingRoutes.post(
  '/elections/:electionId/voters/:voterId/accredit',
  authenticateJWT,
  requireCapability(Capability.ACCREDIT_VOTERS),
  accreditVoterController,
);

export default votingRoutes;
