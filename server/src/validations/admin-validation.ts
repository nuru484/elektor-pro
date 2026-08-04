// src/validations/admin-validation.ts
import { z } from 'zod';

import { DELETED_RESOURCE_KEYS } from '../services/admin/deleted-records.service.js';

const resource = z.enum(
  DELETED_RESOURCE_KEYS as [string, ...string[]],
);

export const deletedResourceParamsSchema = z.object({ resource });

export const deletedRecordParamsSchema = z.object({
  id: z.string().min(1),
  resource,
});
