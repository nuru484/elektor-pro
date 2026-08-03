// src/controllers/dashboard.controller.ts
import type { Request, Response } from 'express';

import { asyncHandler, UnauthorizedError } from '../middlewares/error-handler.js';
import { listAuditLogs, verifyAuditIntegrity } from '../services/audit/audit-read.service.js';
import {
  getAdminDashboard,
  getAgentDashboard,
  getCandidateDashboard,
} from '../services/dashboard/dashboard.service.js';
import { parsePagination, sendList, sendOk } from '../utils/http.js';

const userIdOf = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user.id;
};

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export const adminDashboardController = asyncHandler(
  async (_req: Request, res: Response) => {
    sendOk(res, 'Dashboard retrieved', await getAdminDashboard());
  },
);

export const agentDashboardController = asyncHandler(
  async (req: Request, res: Response) => {
    sendOk(res, 'Dashboard retrieved', await getAgentDashboard(userIdOf(req)));
  },
);

export const candidateDashboardController = asyncHandler(
  async (req: Request, res: Response) => {
    sendOk(res, 'Dashboard retrieved', await getCandidateDashboard(userIdOf(req)));
  },
);

export const listAuditLogsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listAuditLogs(
      {
        action: str(req.query.action),
        actorId: str(req.query.actorId),
        entity: str(req.query.entity),
      },
      parsePagination(req.query),
    );
    sendList(res, 'Audit logs retrieved', result.data, result.meta);
  },
);

export const verifyAuditController = asyncHandler(
  async (_req: Request, res: Response) => {
    sendOk(res, 'Audit integrity checked', await verifyAuditIntegrity());
  },
);
