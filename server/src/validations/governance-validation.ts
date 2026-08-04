// src/validations/governance-validation.ts
import { z } from 'zod';

import { Capability, Role } from '../../generated/prisma/client.js';

export const createStaffUserSchema = z.object({
  email: z.email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().min(6).max(20).optional(),
  role: z.enum([Role.ADMIN, Role.AGENT, Role.CANDIDATE, Role.ACCREDITOR]),
});

export const assignAgentSchema = z.object({
  candidateId: z.string().optional(),
  electionId: z.string().min(1),
  userId: z.string().min(1),
});

export const grantSchema = z.object({
  capability: z.enum(Capability),
  electionId: z.string().optional(),
  expiresAt: z.coerce.date().optional(),
  userId: z.string().min(1),
});
