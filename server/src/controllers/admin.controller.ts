// src/controllers/admin.controller.ts
import type { Request, RequestHandler, Response } from 'express';

import {
  asyncHandler,
  UnauthorizedError,
} from '../middlewares/error-handler.js';
import validationMiddleware from '../middlewares/validation.js';
import {
  type DeletedResource,
  listDeleted,
  purgeDeleted,
  restoreDeleted,
  summarizeDeleted,
} from '../services/admin/deleted-records.service.js';
import { requestContextOf } from '../utils/auth-session.js';
import { dayBoundary } from '../utils/date-window.js';
import { parsePagination, sendList, sendOk } from '../utils/http.js';
import {
  deletedRecordParamsSchema,
  deletedResourceParamsSchema,
} from '../validations/admin-validation.js';

const actorOf = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return { id: req.user.id, role: req.user.role };
};

const handleSummary = asyncHandler(async (_req: Request, res: Response) => {
  sendOk(res, 'Deleted record counts retrieved', await summarizeDeleted());
});

const handleList = asyncHandler(async (req: Request, res: Response) => {
  const { resource } = req.params as { resource: DeletedResource };
  const result = await listDeleted(
    resource,
    {
      from: dayBoundary(req.query.from),
      to: dayBoundary(req.query.to, true),
    },
    parsePagination(req.query),
  );
  sendList(res, 'Deleted records retrieved', result.data, result.meta);
});

const handleRestore = asyncHandler(async (req: Request, res: Response) => {
  const { id, resource } = req.params as { id: string; resource: DeletedResource };
  const row = await restoreDeleted(resource, id, actorOf(req), requestContextOf(req));
  sendOk(res, 'Record restored', row);
});

const handlePurge = asyncHandler(async (req: Request, res: Response) => {
  const { id, resource } = req.params as { id: string; resource: DeletedResource };
  await purgeDeleted(resource, id, actorOf(req), requestContextOf(req));
  sendOk(res, 'Record permanently deleted', null);
});

export const deletedSummary: RequestHandler[] = [handleSummary];

export const deletedList: RequestHandler[] = [
  ...validationMiddleware.custom(deletedResourceParamsSchema, 'params'),
  handleList,
];

export const deletedRestore: RequestHandler[] = [
  ...validationMiddleware.custom(deletedRecordParamsSchema, 'params'),
  handleRestore,
];

export const deletedPurge: RequestHandler[] = [
  ...validationMiddleware.custom(deletedRecordParamsSchema, 'params'),
  handlePurge,
];
