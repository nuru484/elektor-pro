// src/routes/voting/index.ts
import { Router } from 'express';

import { Capability, Role } from '../../../generated/prisma/client.js';
import {
  addToRollController,
  listRollController,
  removeFromRollController,
  setRollEligibilityController,
} from '../../controllers/roll.controller.js';
import {
  accreditVoterController,
  castBallotController,
  getBallotController,
  listVoterElectionsController,
  requestOtpController,
  verifyBallotChainController,
  verifyOtpController,
  verifyReceiptController,
} from '../../controllers/voting.controller.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../../middlewares/authorize-roles.js';
import { authRateLimiter } from '../../middlewares/rateLimit.js';
import { requireCapability } from '../../middlewares/require-capability.js';

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

// Public integrity verification (receipt inclusion + whole-chain re-derivation)
votingRoutes.get('/elections/:electionId/receipts/:code', verifyReceiptController);
votingRoutes.get('/elections/:electionId/ballots/verify', verifyBallotChainController);

// Accreditation (staff with capability)
votingRoutes.post(
  '/elections/:electionId/voters/:voterId/accredit',
  authenticateJWT,
  requireCapability(Capability.ACCREDIT_VOTERS),
  accreditVoterController,
);

// Election roll management (staff with capability)
votingRoutes.get(
  '/elections/:electionId/roll',
  authenticateJWT,
  requireCapability(Capability.MANAGE_VOTERS),
  listRollController,
);
votingRoutes.post(
  '/elections/:electionId/roll',
  authenticateJWT,
  requireCapability(Capability.MANAGE_VOTERS),
  ...addToRollController,
);
votingRoutes.patch(
  '/elections/:electionId/roll/:voterId',
  authenticateJWT,
  requireCapability(Capability.MANAGE_VOTERS),
  ...setRollEligibilityController,
);
votingRoutes.delete(
  '/elections/:electionId/roll/:voterId',
  authenticateJWT,
  requireCapability(Capability.MANAGE_VOTERS),
  removeFromRollController,
);

export default votingRoutes;
