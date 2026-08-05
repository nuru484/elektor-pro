// src/services/auth/otp.service.ts
//
// Shared one-time-code issue/verify used by every OTP flow (voter login,
// staff email 2FA, email/phone change confirmation). Codes are stored hashed,
// resend-throttled, attempt-limited, and single-use.
import type { OtpPurpose } from '../../../generated/prisma/client.js';
import type { AppDeps } from '../deps.js';

import {
  TooManyRequestsError,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import { generateNumericCode, safeEqual, sha256 } from '../../utils/crypto.js';

const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_WINDOW_MS = 60 * 1000;

export const makeOtpService = (d: Pick<AppDeps, 'clock' | 'config' | 'prisma'>) => {
  const { clock, config, prisma } = d;

  /**
   * Issue a fresh code for (user, purpose). Throttled: at most one new code
   * per resend window. Previous unconsumed codes for the same purpose are
   * invalidated so only the latest can ever verify.
   */
  const issue = async (
    userId: string,
    purpose: OtpPurpose,
  ): Promise<{ code: string; expiresAt: Date; id: string; ttlMinutes: number }> => {
    const recent = await prisma.otp.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
      where: { purpose, userId },
    });
    if (recent && clock.timestamp() - recent.createdAt.getTime() < OTP_RESEND_WINDOW_MS) {
      throw new TooManyRequestsError('Please wait before requesting another code');
    }

    const code = generateNumericCode(config.OTP_LENGTH);
    const expiresAt = new Date(clock.timestamp() + config.OTP_TTL_MINUTES * 60 * 1000);

    // Invalidate older outstanding codes, then store only the newest.
    await prisma.otp.updateMany({
      data: { consumedAt: clock.now() },
      where: { consumedAt: null, purpose, userId },
    });
    const created = await prisma.otp.create({
      data: { codeHash: sha256(code), expiresAt, purpose, userId },
      select: { id: true },
    });

    return { code, expiresAt, id: created.id, ttlMinutes: config.OTP_TTL_MINUTES };
  };

  /**
   * Throw away a code that was issued but never actually delivered. Deleted,
   * not consumed: the resend throttle looks at the most recent row for the
   * (user, purpose) pair regardless of state, so leaving the row behind would
   * make a failed send lock the user out of retrying for the whole window.
   */
  const discard = async (otpId: string): Promise<void> => {
    await prisma.otp.deleteMany({ where: { id: otpId } });
  };

  /** Verify and consume the latest outstanding code for (user, purpose). */
  const verify = async (userId: string, purpose: OtpPurpose, code: string): Promise<void> => {
    const otp = await prisma.otp.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { consumedAt: null, purpose, userId },
    });
    if (!otp || otp.expiresAt < clock.now()) {
      throw new UnauthorizedError('Code expired. Request a new one.');
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      throw new TooManyRequestsError('Too many attempts. Request a new code.');
    }

    if (!safeEqual(otp.codeHash, sha256(code.trim()))) {
      await prisma.otp.update({
        data: { attempts: { increment: 1 } },
        where: { id: otp.id },
      });
      throw new UnauthorizedError('Invalid code');
    }

    await prisma.otp.update({
      data: { consumedAt: clock.now() },
      where: { id: otp.id },
    });
  };

  return { discard, issue, verify };
};

export type OtpService = ReturnType<typeof makeOtpService>;
