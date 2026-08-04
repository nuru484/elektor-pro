// src/validations/permissions-validation.ts
import { z } from 'zod';

import { Capability, Role } from '../../generated/prisma/client.js';

export const rolePermissionsParamsSchema = z.object({
  role: z.enum(Role),
});

export const updateRolePermissionsSchema = z.object({
  capabilities: z
    .array(z.enum(Capability))
    .max(Object.values(Capability).length * 2),
});
