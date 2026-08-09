// src/routes/governance/index.ts
import { Router } from 'express';

import { Capability, Role } from '../../../generated/prisma/client.js';
import {
  assignAccreditorController,
  assignAgentController,
  createStaffUserController,
  grantController,
  listAccreditorAssignmentsController,
  listAgentAssignmentsController,
  listGrantsController,
  listStaffUsersController,
  myAccreditationElectionsController,
  removeAccreditorAssignmentController,
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

// Accreditor assignments: which elections each accreditor may work.
governanceRoutes.get(
  '/accreditors',
  authenticateJWT,
  requireCapability(Capability.MANAGE_AGENTS),
  listAccreditorAssignmentsController,
);
governanceRoutes.post(
  '/accreditors',
  authenticateJWT,
  requireCapability(Capability.MANAGE_AGENTS),
  ...assignAccreditorController,
);
governanceRoutes.delete(
  '/accreditors/:id',
  authenticateJWT,
  requireCapability(Capability.MANAGE_AGENTS),
  removeAccreditorAssignmentController,
);
// The signed-in accreditor's own desks (staff see every open election).
governanceRoutes.get(
  '/my-accreditation-elections',
  authenticateJWT,
  requireCapability(Capability.ACCREDIT_VOTERS),
  myAccreditationElectionsController,
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
