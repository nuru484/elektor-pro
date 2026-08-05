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
  codeLoginController,
  getBallotController,
  getTurnoutController,
  listVoterElectionsController,
  requestOtpController,
  revokeAccreditationController,
  searchAccreditationController,
  verifyBallotChainController,
  verifyOtpController,
  verifyReceiptController,
  voterHistoryController,
} from '../../controllers/voting.controller.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../../middlewares/authorize-roles.js';
import {
  authRateLimiter,
  integrityVerifyLimiter,
  votingLimiter,
} from '../../middlewares/rateLimit.js';
import { requireCapability } from '../../middlewares/require-capability.js';

const votingRoutes = Router();

// Voter authentication (phone OTP, or a one-time accreditation code)
votingRoutes.post('/voter/otp/request', authRateLimiter, ...requestOtpController);
votingRoutes.post('/voter/otp/verify', authRateLimiter, ...verifyOtpController);
votingRoutes.post('/voter/code-login', authRateLimiter, ...codeLoginController);

// Voter ballot flow (role VOTER)
votingRoutes.get(
  '/voter/elections',
  authenticateJWT,
  authorizeRole([Role.VOTER]),
  listVoterElectionsController,
);
votingRoutes.get(
  '/voter/history',
  authenticateJWT,
  authorizeRole([Role.VOTER]),
  voterHistoryController,
);
votingRoutes.get(
  '/voter/elections/:electionId/ballot',
  authenticateJWT,
  authorizeRole([Role.VOTER]),
  getBallotController,
);
votingRoutes.post(
  '/voter/elections/:electionId/ballot',
  votingLimiter,
  authenticateJWT,
  authorizeRole([Role.VOTER]),
  ...castBallotController,
);

// Public integrity verification (receipt inclusion + whole-chain re-derivation).
// Anyone may prove the chain is intact; the whole-chain check re-derives every
// ballot, so it carries its own tighter limit on top of the cached result.
votingRoutes.get('/elections/:electionId/receipts/:code', verifyReceiptController);
votingRoutes.get(
  '/elections/:electionId/ballots/verify',
  integrityVerifyLimiter,
  verifyBallotChainController,
);

// Accreditation desk (staff with capability)
votingRoutes.get(
  '/elections/:electionId/accreditation/search',
  authenticateJWT,
  requireCapability(Capability.ACCREDIT_VOTERS),
  searchAccreditationController,
);
votingRoutes.post(
  '/elections/:electionId/voters/:voterId/accredit',
  authenticateJWT,
  requireCapability(Capability.ACCREDIT_VOTERS),
  accreditVoterController,
);
votingRoutes.delete(
  '/elections/:electionId/voters/:voterId/accredit',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  revokeAccreditationController,
);

// Live turnout (admins, assigned agents, accreditors, results viewers)
votingRoutes.get(
  '/elections/:electionId/turnout',
  authenticateJWT,
  getTurnoutController,
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
