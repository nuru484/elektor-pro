// src/services/auth/session.service.ts
//
// Refresh-token sessions: one row per signed-in device. The refresh JWT
// carries the session id; the hash of the CURRENT refresh token is stored on
// the row and rotated on every refresh, so:
//   - a stolen older refresh token is dead on arrival (hash mismatch), and
//     presenting one revokes the whole session (reuse = compromise signal);
//   - users can list their signed-in devices and revoke any of them;
//   - a password change can kill every other session at once.
import type { Role } from '../../../generated/prisma/client.js';
import type { AppDeps } from '../deps.js';

import { NotFoundError, UnauthorizedError } from '../../middlewares/error-handler.js';
import { sha256 } from '../../utils/crypto.js';
import {
  decodeTokenExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionView {
  createdAt: Date;
  current: boolean;
  id: string;
  ipAddress: null | string;
  lastUsedAt: Date;
  userAgent: null | string;
}

export const makeSessionService = (d: Pick<AppDeps, 'clock' | 'prisma'>) => {
  const { clock, prisma } = d;

  /** Start a new session for a fresh login and sign its token pair. */
  const createSession = async (
    user: { id: string; role: Role },
    ctx: SessionContext = {},
  ): Promise<IssuedTokens> => {
    const session = await prisma.session.create({
      data: {
        // Placeholder until the real token is signed below (the token needs
        // the session id, and the row needs the token's hash).
        expiresAt: clock.now(),
        ipAddress: ctx.ipAddress ?? null,
        tokenHash: `pending:${crypto.randomUUID()}`,
        userAgent: ctx.userAgent ?? null,
        userId: user.id,
      },
      select: { id: true },
    });

    const refreshToken = signRefreshToken({ id: user.id, role: user.role, sessionId: session.id });
    const accessToken = signAccessToken({ id: user.id, role: user.role, sessionId: session.id });
    await prisma.session.update({
      data: {
        expiresAt: decodeTokenExpiry(refreshToken) ?? clock.now(),
        tokenHash: sha256(refreshToken),
      },
      where: { id: session.id },
    });

    return { accessToken, refreshToken, sessionId: session.id };
  };

  /**
   * Exchange a presented refresh token for a fresh pair, rotating the stored
   * hash. Presenting a stale (already-rotated) token is treated as token
   * theft: the session is revoked outright.
   */
  const rotateSession = async (presentedToken: string): Promise<IssuedTokens & { userId: string }> => {
    const payload = verifyRefreshToken(presentedToken);
    const session = await prisma.session.findUnique({
      select: { expiresAt: true, id: true, revokedAt: true, tokenHash: true, userId: true },
      where: { id: payload.sessionId },
    });
    if (!session || session.revokedAt || session.expiresAt < clock.now()) {
      throw new UnauthorizedError('Session expired. Please log in again.', {
        code: 'SESSION_EXPIRED',
        layer: 'session',
      });
    }
    if (session.tokenHash !== sha256(presentedToken)) {
      // Reuse of a rotated token - assume compromise and kill the session.
      await prisma.session.update({
        data: { revokedAt: clock.now() },
        where: { id: session.id },
      });
      throw new UnauthorizedError('Session invalidated. Please log in again.', {
        code: 'SESSION_REUSE',
        layer: 'session',
      });
    }

    const refreshToken = signRefreshToken({
      id: payload.id,
      role: payload.role,
      sessionId: session.id,
    });
    const accessToken = signAccessToken({ id: payload.id, role: payload.role, sessionId: session.id });
    await prisma.session.update({
      data: {
        expiresAt: decodeTokenExpiry(refreshToken) ?? undefined,
        lastUsedAt: clock.now(),
        tokenHash: sha256(refreshToken),
      },
      where: { id: session.id },
    });

    return { accessToken, refreshToken, sessionId: session.id, userId: session.userId };
  };

  /** Active (non-revoked, unexpired) sessions for the account page. */
  const listSessions = async (
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionView[]> => {
    const sessions = await prisma.session.findMany({
      orderBy: { lastUsedAt: 'desc' },
      select: {
        createdAt: true,
        id: true,
        ipAddress: true,
        lastUsedAt: true,
        userAgent: true,
      },
      where: { expiresAt: { gt: clock.now() }, revokedAt: null, userId },
    });
    return sessions.map((s) => ({ ...s, current: s.id === currentSessionId }));
  };

  /** Revoke one of the caller's own sessions (sign that device out). */
  const revokeSession = async (userId: string, sessionId: string): Promise<void> => {
    const updated = await prisma.session.updateMany({
      data: { revokedAt: clock.now() },
      where: { id: sessionId, revokedAt: null, userId },
    });
    if (updated.count === 0) throw new NotFoundError('Session not found');
  };

  /** Sign out everywhere else (kept: the session performing the action). */
  const revokeOtherSessions = async (userId: string, keepSessionId: string): Promise<number> => {
    const updated = await prisma.session.updateMany({
      data: { revokedAt: clock.now() },
      where: { id: { not: keepSessionId }, revokedAt: null, userId },
    });
    return updated.count;
  };

  /** Kill every session (password reset / admin lock). */
  const revokeAllSessions = async (userId: string): Promise<number> => {
    const updated = await prisma.session.updateMany({
      data: { revokedAt: clock.now() },
      where: { revokedAt: null, userId },
    });
    return updated.count;
  };

  return {
    createSession,
    listSessions,
    revokeAllSessions,
    revokeOtherSessions,
    revokeSession,
    rotateSession,
  };
};

export type SessionService = ReturnType<typeof makeSessionService>;
