// src/routes/users/index.ts
// Administrative user management. Listing is staff-wide read; mutations are
// admin actions on OTHER accounts (self-service lives under /auth/profile).
import { Router } from 'express';

import { Role } from '../../../generated/prisma/client.js';
import {
  confirmUserContactController,
  deleteUserController,
  getUserController,
  listUsersController,
  lockUserController,
  requestUserContactController,
  updateUserContactController,
  updateUserController,
  updateUserPictureController,
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
usersRoutes.post(
  '/:userId/lock',
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  ...lockUserController,
);
usersRoutes.patch(
  '/:userId/picture',
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  ...updateUserPictureController,
);
// Contact edits: super-admins apply directly (typed confirmation in the UI);
// admins must verify via a code sent to the NEW contact so unreachable
// details never enter the system.
usersRoutes.patch(
  '/:userId/contact',
  authorizeRole([Role.SUPER_ADMIN]),
  ...updateUserContactController,
);
usersRoutes.post(
  '/:userId/contact/request',
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  ...requestUserContactController,
);
usersRoutes.post(
  '/:userId/contact/confirm',
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  ...confirmUserContactController,
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
