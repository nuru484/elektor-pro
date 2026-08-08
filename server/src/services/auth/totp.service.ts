// src/services/auth/totp.service.ts
// TOTP (RFC 6238) helpers for staff two-factor authentication.
import { generateSecret, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';

/** TOTP step length in seconds (RFC 6238 default, and otplib's). */
const TOTP_STEP_SECONDS = 30;

/** Allow a small clock-drift window of ±1 step. */
const EPOCH_TOLERANCE_SECONDS = TOTP_STEP_SECONDS;

export const generateTotpSecret = (): string => generateSecret();

export const buildOtpAuthUrl = (
  secret: string,
  accountLabel: string,
  issuer: string,
): string => generateURI({ issuer, label: accountLabel, secret });

export const buildQrDataUrl = (otpAuthUrl: string): Promise<string> =>
  qrcode.toDataURL(otpAuthUrl);

export const verifyTotp = (token: string, secret: string): boolean => {
  try {
    return verifySync({
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
      secret,
      token,
    }).valid;
  } catch {
    return false;
  }
};

/**
 * Verify a TOTP code and return the exact time step it belongs to, so callers
 * can record it and refuse a replay.
 *
 * `verify` alone only answers "is this code currently valid", and it stays
 * valid for the whole ±1-step drift window - so a code observed over someone's
 * shoulder, or captured from a phished form, could be replayed for about 90
 * seconds. Resolving the step turns the code into a single-use credential.
 *
 * Returns null when the code does not verify.
 */
export const verifyTotpStep = (
  token: string,
  secret: string,
  now: Date,
): null | number => {
  try {
    const result = verifySync({
      epoch: Math.floor(now.getTime() / 1000),
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
      secret,
      token,
    });
    // verifySync's result type is a TOTP/HOTP union and only the TOTP branch
    // carries timeStep; we always verify TOTP, so the check is for the types.
    return result.valid && 'timeStep' in result ? result.timeStep : null;
  } catch {
    return null;
  }
};
