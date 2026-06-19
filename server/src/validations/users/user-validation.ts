// src/validations/users/user-validation.ts
import { z } from 'zod';

import { Role, Status } from '../../../generated/prisma/client.js';

export const updateUserValidation = z
  .object({
    email: z.email().toLowerCase().trim().optional().nullable(),
    firstName: z.string().min(2).max(50).trim().optional(),
    lastName: z.string().min(2).max(50).trim().optional(),
    phone: z
      .string()
      .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/)
      .trim()
      .nullable()
      .optional(),
    role: z.enum(Role).optional(),
    status: z.enum(Status).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
    path: [],
  });

export const updateUserRoleValidation = z.object({
  role: z.enum(Role),
});

export const userQueryValidation = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  role: z.enum(Role).optional(),
  search: z.string().max(100).trim().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'firstName', 'lastName', 'email'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  status: z.enum(Status).optional(),
});
