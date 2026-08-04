// src/controllers/permissions.controller.ts
import type { Request, RequestHandler, Response } from 'express';

import type { Capability, Role } from '../../generated/prisma/client.js';

import {
  asyncHandler,
  UnauthorizedError,
} from '../middlewares/error-handler.js';
import validationMiddleware from '../middlewares/validation.js';
import {
  listCapabilityMatrix,
  replaceRoleCapabilities,
} from '../services/authorization/role-capability.service.js';
import { requestContextOf } from '../utils/auth-session.js';
import { sendOk } from '../utils/http.js';
import {
  rolePermissionsParamsSchema,
  updateRolePermissionsSchema,
} from '../validations/permissions-validation.js';

const handleListPermissions = asyncHandler(
  async (_req: Request, res: Response) => {
    sendOk(res, 'Permissions retrieved', await listCapabilityMatrix());
  },
);

const handleUpdateRolePermissions = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { role } = req.params as unknown as { role: Role };
    const { capabilities } = req.body as { capabilities: Capability[] };
    const result = await replaceRoleCapabilities(
      role,
      capabilities,
      { id: req.user.id, role: req.user.role },
      requestContextOf(req),
    );
    sendOk(res, 'Role permissions updated', result);
  },
);

export const listPermissions: RequestHandler[] = [handleListPermissions];

export const updateRolePermissions: RequestHandler[] = [
  ...validationMiddleware.custom(rolePermissionsParamsSchema, 'params'),
  ...validationMiddleware.update(updateRolePermissionsSchema),
  handleUpdateRolePermissions,
];
