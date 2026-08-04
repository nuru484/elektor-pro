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

/** Staff roles are interchangeable; AGENT/CANDIDATE/VOTER accounts belong
 * to their own modules and never pass through the role changer. */
export const updateUserRoleSchema = z.object({
  role: z.enum([Role.SUPER_ADMIN, Role.ADMIN, Role.ACCREDITOR]),
});

/** Contact edits: exactly one channel per request keeps the OTP unambiguous. */
export const adminContactChangeSchema = z
  .object({
    email: z.email().optional(),
    phone: z.string().min(6).max(20).optional(),
  })
  .refine((data) => Boolean(data.email) !== Boolean(data.phone), {
    message: 'Provide an email or a phone number (one at a time)',
  });

export const contactConfirmSchema = z.object({
  code: z.string().min(4).max(10),
});

export const userListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  role: z.enum(Role).optional(),
  search: z.string().max(100).trim().optional(),
  status: z.enum(Status).optional(),
});
