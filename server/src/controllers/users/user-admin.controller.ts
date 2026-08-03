// src/controllers/users/user-admin.controller.ts
import type { Request, RequestHandler, Response } from 'express';

import type { Role, Status } from '../../../generated/prisma/client.js';

import {
  asyncHandler,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import validationMiddleware from '../../middlewares/validation.js';
import { userAdminService } from '../../services/users/user-admin.service.js';
import { requestContextOf } from '../../utils/auth-session.js';
import { parsePagination, sendList, sendOk } from '../../utils/http.js';
import {
  adminUpdateUserSchema,
  updateUserRoleSchema,
  userListQuerySchema,
} from '../../validations/users/user-validation.js';

const actorOf = (req: Request): { id: string; role: Role } => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return { id: req.user.id, role: req.user.role };
};

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const handleListUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await userAdminService.listUsers(
    {
      role: str(req.query.role) as Role | undefined,
      search: str(req.query.search),
      status: str(req.query.status) as Status | undefined,
    },
    parsePagination(req.query),
  );
  sendList(res, 'Users retrieved', result.data, result.meta);
});

const handleGetUser = asyncHandler(async (req: Request, res: Response) => {
  sendOk(res, 'User retrieved', await userAdminService.getUser(req.params.userId));
});

const handleUpdateUser = asyncHandler(async (req: Request, res: Response) => {
  const data = await userAdminService.updateUser(
    actorOf(req),
    req.params.userId,
    req.body as { firstName?: string; lastName?: string; status?: Status },
    requestContextOf(req),
  );
  sendOk(res, 'User updated', data);
});

const handleUpdateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.body as { role: Role };
  const data = await userAdminService.updateUserRole(
    actorOf(req),
    req.params.userId,
    role,
    requestContextOf(req),
  );
  sendOk(res, 'Role updated', data);
});

const handleDeleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userAdminService.deleteUser(actorOf(req), req.params.userId, requestContextOf(req));
  sendOk(res, 'User deleted', { id: req.params.userId });
});

export const listUsersController: RequestHandler[] = [
  ...validationMiddleware.query(userListQuerySchema),
  handleListUsers,
];
export const getUserController = handleGetUser;
export const updateUserController: RequestHandler[] = [
  ...validationMiddleware.update(adminUpdateUserSchema),
  handleUpdateUser,
];
export const updateUserRoleController: RequestHandler[] = [
  ...validationMiddleware.update(updateUserRoleSchema),
  handleUpdateUserRole,
];
export const deleteUserController = handleDeleteUser;
