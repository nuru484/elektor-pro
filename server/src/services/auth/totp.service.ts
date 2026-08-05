// src/services/auth/totp.service.ts
// TOTP (RFC 6238) helpers for staff two-factor authentication.
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

// Allow a small time drift window (±1 step).
authenticator.options = { window: 1 };

export const generateTotpSecret = (): string => authenticator.generateSecret();

export const buildOtpAuthUrl = (
  secret: string,
  accountLabel: string,
  issuer: string,
): string => authenticator.keyuri(accountLabel, issuer, secret);

export const buildQrDataUrl = (otpAuthUrl: string): Promise<string> =>
  qrcode.toDataURL(otpAuthUrl);

export const verifyTotp = (token: string, secret: string): boolean => {
  try {
    return authenticator.verify({ secret, token });
  } catch {
    return false;
  }
};

/** TOTP step length in seconds (RFC 6238 default, and otplib's). */
const TOTP_STEP_SECONDS = 30;

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
  let delta: null | number;
  try {
    delta = authenticator.checkDelta(token, secret);
  } catch {
    return null;
  }
  if (delta === null) return null;
  const currentStep = Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS);
  return currentStep + delta;
};
