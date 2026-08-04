// src/services/auth/password-gate.service.ts
//
// Server-side enforcement of the first-login password change. Admin-created
// accounts carry mustChangePassword = true; until they change it, every
// authenticated request except the change itself (and /auth/me, which the
// client needs to route them) is refused. The flag is read behind a short
// in-process cache so the check does not add a DB round-trip to every request;
// the change/reset paths invalidate the entry so the unlock is immediate.
import prisma from '../../lib/prisma.js';

const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { expiresAt: number; mustChange: boolean }>();

/** Whether this user is still locked behind the forced password change. */
export const mustChangePassword = async (userId: string): Promise<boolean> => {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) return cached.mustChange;

  const user = await prisma.user.findUnique({
    select: { mustChangePassword: true },
    where: { id: userId },
  });
  const mustChange = user?.mustChangePassword ?? false;
  cache.set(userId, { expiresAt: now + CACHE_TTL_MS, mustChange });
  return mustChange;
};

/** Drop a user's cached flag (called after a password change/reset). */
export const invalidatePasswordGate = (userId: string): void => {
  cache.delete(userId);
};

/** Test-only: clear the cache between specs. */
export const _resetPasswordGateForTests = (): void => {
  cache.clear();
};
