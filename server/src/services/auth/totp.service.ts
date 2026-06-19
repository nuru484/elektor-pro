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
