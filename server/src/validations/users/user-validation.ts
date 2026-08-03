// src/validations/users/user-validation.ts
import { z } from 'zod';

import { Role, Status } from '../../../generated/prisma/client.js';

/** Admin edit of another account: identity fields + status only. */
export const adminUpdateUserSchema = z
  .object({
    firstName: z.string().min(1).max(80).trim().optional(),
    lastName: z.string().min(1).max(80).trim().optional(),
    status: z.enum(Status).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateUserRoleSchema = z.object({
  role: z.enum(Role),
});

export const userListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  role: z.enum(Role).optional(),
  search: z.string().max(100).trim().optional(),
  status: z.enum(Status).optional(),
});
