// src/routes/governance/index.ts
import { Router } from 'express';

import { Capability, Role } from '../../../generated/prisma/client.js';
import {
  assignAgentController,
  createStaffUserController,
  grantController,
  listAgentAssignmentsController,
  listGrantsController,
  listStaffUsersController,
  removeAgentAssignmentController,
  revokeGrantController,
} from '../../controllers/governance.controller.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../../middlewares/authorize-roles.js';
import { requireCapability } from '../../middlewares/require-capability.js';

const governanceRoutes = Router();

// Staff accounts
governanceRoutes.get(
  '/staff-users',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  listStaffUsersController,
);
governanceRoutes.post(
  '/staff-users',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  ...createStaffUserController,
);

// Agent assignments
governanceRoutes.get(
  '/agents',
  authenticateJWT,
  requireCapability(Capability.MANAGE_AGENTS),
  listAgentAssignmentsController,
);
governanceRoutes.post(
  '/agents',
  authenticateJWT,
  requireCapability(Capability.MANAGE_AGENTS),
  ...assignAgentController,
);
governanceRoutes.delete(
  '/agents/:id',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  removeAgentAssignmentController,
);

// Capability grants (super-admin)
governanceRoutes.get(
  '/grants',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  listGrantsController,
);
governanceRoutes.post(
  '/grants',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  ...grantController,
);
governanceRoutes.delete(
  '/grants/:id',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  revokeGrantController,
);

export default governanceRoutes;
