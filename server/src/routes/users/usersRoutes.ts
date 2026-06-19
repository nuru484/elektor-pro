// src/routes/users/usersRoutes.ts
import { Router } from 'express';

import { Role } from '../../../generated/prisma/client.js';
import {
  deleteAllUsers,
  deleteUser,
  getAllUsers,
  getUser,
  updateUser,
  updateUserProfilePicture,
  updateUserRole,
} from '../../controllers/users/index.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../../middlewares/authorize-roles.js';

const usersRouter = Router();

// Listing and hard administrative actions are super-admin only.
usersRouter.get('/', authenticateJWT, authorizeRole([Role.SUPER_ADMIN]), getAllUsers);

usersRouter.get(
  '/user/:userId',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  getUser,
);

usersRouter.put(
  '/user/:userId',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  ...updateUser,
);

usersRouter.patch(
  '/user/:userId/role',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  updateUserRole,
);

usersRouter.patch(
  '/user/:userId/profile-picture',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN, Role.ADMIN]),
  ...updateUserProfilePicture,
);

usersRouter.delete(
  '/user/:userId',
  authenticateJWT,
  authorizeRole([Role.SUPER_ADMIN]),
  deleteUser,
);

usersRouter.delete('/', authenticateJWT, authorizeRole([Role.SUPER_ADMIN]), deleteAllUsers);

export default usersRouter;
