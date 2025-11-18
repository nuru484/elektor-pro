// src/routes/authentication/register.ts
import { Router } from 'express';
import {
  getAllUsers,
  getUser,
  updateUser,
  updateUserRole,
  updateUserProfilePicture,
  deleteUser,
  deleteAllUsers,
} from '../../controllers/users/index.js';
import authenticateJWT from '../../middlewares/authenticate-jwt.js';
import { authorizeRole } from '../../middlewares/authorize-roles.js';
import { Role } from '../../../generated/prisma/index.js';

const usersRouter = Router();

usersRouter.get('/', authenticateJWT, authorizeRole([Role.ADMIN]), getAllUsers);

usersRouter.get(
  '/user/:userId',
  authenticateJWT,
  authorizeRole([Role.ADMIN, Role.CLIENT, Role.LAWYER]),
  getUser,
);

usersRouter.put(
  '/user/:userId',
  authenticateJWT,
  authorizeRole([Role.ADMIN, Role.CLIENT, Role.LAWYER]),
  ...updateUser,
);

usersRouter.patch(
  '/user/:userId/role',
  authenticateJWT,
  authorizeRole([Role.ADMIN, Role.LAWYER, Role.CLIENT]),
  updateUserRole,
);

usersRouter.patch(
  '/user/:userId/profilePicture',
  authenticateJWT,
  authorizeRole([Role.ADMIN, Role.LAWYER, Role.CLIENT]),
  ...updateUserProfilePicture,
);

usersRouter.delete(
  '/user/:userId',
  authenticateJWT,
  authorizeRole([Role.ADMIN]),
  deleteUser,
);

usersRouter.delete(
  '/',
  authenticateJWT,
  authorizeRole([Role.ADMIN]),
  deleteAllUsers,
);

export default usersRouter;
