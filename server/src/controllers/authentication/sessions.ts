// src/controllers/authentication/sessions.ts
import type { Request, Response } from 'express';

import {
  asyncHandler,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import { makeSessionService } from '../../services/auth/session.service.js';
import { defaultDeps } from '../../services/deps.js';
import { sendOk } from '../../utils/http.js';

const sessions = makeSessionService(defaultDeps);

const authOf = (req: Request): { sessionId?: string; userId: string } => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return { sessionId: req.user.sessionId, userId: req.user.id };
};

/** The caller's active sessions, newest first, current one flagged. */
export const listSessionsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { sessionId, userId } = authOf(req);
    sendOk(res, 'Sessions retrieved', await sessions.listSessions(userId, sessionId));
  },
);

/** Sign a specific device out. */
export const revokeSessionController = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = authOf(req);
    await sessions.revokeSession(userId, req.params.sessionId);
    sendOk(res, 'Session revoked', { id: req.params.sessionId });
  },
);

/** Sign out everywhere else. */
export const revokeOtherSessionsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { sessionId, userId } = authOf(req);
    if (!sessionId) throw new UnauthorizedError('Session information missing');
    const revoked = await sessions.revokeOtherSessions(userId, sessionId);
    sendOk(res, 'Other sessions revoked', { revoked });
  },
);
