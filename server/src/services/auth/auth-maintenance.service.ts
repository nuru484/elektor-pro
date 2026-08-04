// src/services/auth/auth-maintenance.service.ts
//
// Hygiene sweep for short-lived auth records. OTPs, password-reset tokens,
// and sessions all expire logically but their rows otherwise accumulate
// forever. The sweep deletes rows that can no longer serve any purpose,
// keeping a retention window so operators can still answer "what happened
// yesterday" questions:
//  - OTPs / reset tokens: gone RETENTION_SHORT_MS after expiring or being used
//    (the grace also keeps the OTP resend-throttle's recent-row lookups intact)
//  - sessions: gone RETENTION_SESSION_MS after expiring or being revoked
//    (long enough for device-history forensics after an incident)
// Runs hourly from BullMQ (auth-maintenance.worker.ts); like the election
// sweep it is directly callable, so it works without Redis and is testable.
import prisma from '../../lib/prisma.js';

const RETENTION_SHORT_MS = 24 * 60 * 60 * 1000; // 1 day
const RETENTION_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthSweepResult {
  otps: number;
  resetTokens: number;
  sessions: number;
}

export const sweepExpiredAuthRecords = async (
  now = new Date(),
): Promise<AuthSweepResult> => {
  const shortCutoff = new Date(now.getTime() - RETENTION_SHORT_MS);
  const sessionCutoff = new Date(now.getTime() - RETENTION_SESSION_MS);

  const [otps, resetTokens, sessions] = await prisma.$transaction([
    prisma.otp.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: shortCutoff } },
          { consumedAt: { lt: shortCutoff } },
        ],
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: shortCutoff } },
          { usedAt: { lt: shortCutoff } },
        ],
      },
    }),
    prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: sessionCutoff } },
          { revokedAt: { lt: sessionCutoff } },
        ],
      },
    }),
  ]);

  return {
    otps: otps.count,
    resetTokens: resetTokens.count,
    sessions: sessions.count,
  };
};
