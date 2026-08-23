// src/services/auth/session.service.ts
//
// Refresh-token sessions: one row per signed-in device. The refresh JWT
// carries the session id; the hash of the CURRENT refresh token is stored on
// the row and rotated on every refresh, so:
//   - a stolen older refresh token is dead on arrival (hash mismatch), and
//     presenting one outside the rotation grace window revokes the whole
//     session (reuse = compromise signal);
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

/**
 * The outcome of presenting a refresh token.
 *
 * `rotated: false` is the concurrent-refresh answer: this caller lost a race
 * to another request from the same client, which has already rotated. It gets
 * a working access token but NO new refresh token, because the winner's is the
 * one the session row now holds - see rotateSession.
 */
export type SessionRotation =
  | { accessToken: string; refreshToken: string; rotated: true; sessionId: string; userId: string }
  | { accessToken: string; rotated: false; sessionId: string; userId: string };

export interface SessionView {
  createdAt: Date;
  current: boolean;
  id: string;
  ipAddress: null | string;
  lastUsedAt: Date;
  userAgent: null | string;
}

/**
 * How long the token that was current immediately before a rotation is still
 * accepted.
 *
 * Rotation is not atomic from the client's point of view: two tabs sharing one
 * cookie jar both hit the 30-minute access-token expiry at the same moment and
 * both present the same refresh token. One rotates first; the other's request
 * is already in flight with what is now the previous token. Without this
 * window that benign race reads as theft and revokes the session - the user is
 * browsing normally and is suddenly signed out.
 *
 * Real replay of a stolen token happens long after the rotation it was
 * captured from, so a window this short still trips detection. It is measured
 * from the rotation, not from the token's issue, so it cannot be extended by
 * repeatedly presenting the same stale token.
 */
const ROTATION_GRACE_MS = 30_000;

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
   * hash. A stale token is theft and revokes the session outright - unless it
   * is the immediately-previous one inside the grace window, which is a
   * concurrent refresh from the same client and answers `rotated: false`.
   */
  const rotateSession = async (presentedToken: string): Promise<SessionRotation> => {
    const payload = verifyRefreshToken(presentedToken);
    const session = await prisma.session.findUnique({
      select: {
        expiresAt: true,
        id: true,
        previousTokenHash: true,
        revokedAt: true,
        rotatedAt: true,
        tokenHash: true,
        userId: true,
      },
      where: { id: payload.sessionId },
    });
    if (!session || session.revokedAt || session.expiresAt < clock.now()) {
      throw new UnauthorizedError('Session expired. Please log in again.', {
        code: 'SESSION_EXPIRED',
        layer: 'session',
      });
    }

    const presentedHash = sha256(presentedToken);
    const accessToken = signAccessToken({
      id: payload.id,
      role: payload.role,
      sessionId: session.id,
    });

    if (session.tokenHash !== presentedHash) {
      // Not the current token. Legitimate only if it is the one this session
      // held a moment ago - a second request from the same client that raced a
      // rotation already in flight.
      const rotatedAgo = session.rotatedAt
        ? clock.now().getTime() - session.rotatedAt.getTime()
        : Infinity;
      const concurrentRefresh =
        session.previousTokenHash === presentedHash && rotatedAgo <= ROTATION_GRACE_MS;

      if (!concurrentRefresh) {
        // Genuine reuse of a rotated token - assume compromise, kill the session.
        await prisma.session.update({
          data: { revokedAt: clock.now() },
          where: { id: session.id },
        });
        throw new UnauthorizedError('Session invalidated. Please log in again.', {
          code: 'SESSION_REUSE',
          layer: 'session',
        });
      }
      return { accessToken, rotated: false, sessionId: session.id, userId: session.userId };
    }

    const refreshToken = signRefreshToken({
      id: payload.id,
      role: payload.role,
      sessionId: session.id,
    });
    const now = clock.now();
    // Compare-and-set, not read-then-write: the row must STILL hold the token
    // that was just validated. Two requests can both pass the check above on
    // the same read, and without this both would rotate - leaving the browser
    // holding whichever token arrived last while the row remembers the other.
    const claimed = await prisma.session.updateMany({
      data: {
        expiresAt: decodeTokenExpiry(refreshToken) ?? undefined,
        lastUsedAt: now,
        // The token being retired is what the grace window then covers, so the
        // request that lost the race is still recognised.
        previousTokenHash: presentedHash,
        rotatedAt: now,
        tokenHash: sha256(refreshToken),
      },
      where: { id: session.id, revokedAt: null, tokenHash: presentedHash },
    });
    if (claimed.count === 0) {
      // Someone rotated between the read and the write. Answer as the loser:
      // a usable access token, and the winner's refresh token left alone.
      return { accessToken, rotated: false, sessionId: session.id, userId: session.userId };
    }

    return {
      accessToken,
      refreshToken,
      rotated: true,
      sessionId: session.id,
      userId: session.userId,
    };
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
