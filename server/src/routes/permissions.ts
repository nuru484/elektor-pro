// src/routes/permissions.ts
//
// The runtime permission matrix - super-admin only. GET returns the catalog
// (labels/descriptions/groups) plus the current per-role grants; PUT
// replaces one role's grants.
import { Router } from 'express';

import { Role } from '../../generated/prisma/client.js';
import {
  listPermissions,
  updateRolePermissions,
} from '../controllers/permissions.controller.js';
import authenticateJWT from '../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../middlewares/authorize-roles.js';

const permissionsRoutes = Router();

permissionsRoutes.use(authenticateJWT, authorizeRole([Role.SUPER_ADMIN]));

permissionsRoutes.get('/', ...listPermissions);
permissionsRoutes.put('/:role', ...updateRolePermissions);

export default permissionsRoutes;
