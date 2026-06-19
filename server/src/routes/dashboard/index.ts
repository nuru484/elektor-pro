// src/routes/dashboard/index.ts
import { Router } from 'express';

import {
  adminDashboardController,
  agentDashboardController,
  candidateDashboardController,
  listAuditLogsController,
  verifyAuditController,
} from '../../controllers/dashboard.controller.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../../middlewares/authorize-roles.js';
import { Role } from '../../../generated/prisma/client.js';

const dashboardRoutes = Router();

dashboardRoutes.get(
  '/dashboard/admin',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  adminDashboardController,
);
dashboardRoutes.get(
  '/dashboard/agent',
  authenticateJWT,
  authorizeRole([Role.AGENT]),
  agentDashboardController,
);
dashboardRoutes.get(
  '/dashboard/candidate',
  authenticateJWT,
  authorizeRole([Role.CANDIDATE]),
  candidateDashboardController,
);

dashboardRoutes.get(
  '/audit-logs',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  listAuditLogsController,
);
dashboardRoutes.get(
  '/audit-logs/verify',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  verifyAuditController,
);

export default dashboardRoutes;
