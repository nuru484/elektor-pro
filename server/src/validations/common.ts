// src/validations/common.ts
import { z } from 'zod';

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  search: z.string().max(120).trim().optional(),
});

export const jsonRecord = z.record(z.string(), z.any());
