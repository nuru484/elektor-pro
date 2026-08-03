// src/routes/users/index.ts
// Administrative user management. Listing is staff-wide read; mutations are
// admin actions on OTHER accounts (self-service lives under /auth/profile).
import { Router } from 'express';

import { Role } from '../../../generated/prisma/client.js';
import {
  deleteUserController,
  getUserController,
  listUsersController,
  updateUserController,
  updateUserRoleController,
} from '../../controllers/users/user-admin.controller.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../../middlewares/authorize-roles.js';

const usersRoutes = Router();

usersRoutes.use(authenticateJWT);

usersRoutes.get(
  '/',
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  ...listUsersController,
);
usersRoutes.get(
  '/:userId',
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  getUserController,
);
usersRoutes.patch(
  '/:userId',
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  ...updateUserController,
);
usersRoutes.patch(
  '/:userId/role',
  authorizeRole([Role.SUPER_ADMIN]),
  ...updateUserRoleController,
);
usersRoutes.delete(
  '/:userId',
  authorizeRole([Role.SUPER_ADMIN]),
  deleteUserController,
);

export default usersRoutes;
