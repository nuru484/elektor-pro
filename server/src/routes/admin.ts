// src/routes/admin.ts
//
// The deleted-records manager - super-admin only. Review soft-deleted rows,
// restore them, or purge them permanently.
import { Router } from 'express';

import { Role } from '../../generated/prisma/client.js';
import {
  deletedList,
  deletedPurge,
  deletedRestore,
  deletedSummary,
} from '../controllers/admin.controller.js';
import authenticateJWT from '../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../middlewares/authorize-roles.js';

const adminRoutes = Router();

adminRoutes.use(authenticateJWT, authorizeRole([Role.SUPER_ADMIN]));

adminRoutes.get('/deleted', ...deletedSummary);
adminRoutes.get('/deleted/:resource', ...deletedList);
adminRoutes.post('/deleted/:resource/:id/restore', ...deletedRestore);
adminRoutes.delete('/deleted/:resource/:id', ...deletedPurge);

export default adminRoutes;
