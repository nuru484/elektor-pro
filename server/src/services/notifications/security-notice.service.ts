// src/services/notifications/security-notice.service.ts
//
// Security notification emails: fired on account-security events (password
// changed, 2FA toggled, contact changed, new sign-in). Best-effort by design:
// a mail outage must never fail the security action itself, so every send is
// caught and logged instead of thrown.
import type { AppDeps } from '../deps.js';

interface NoticeContext {
  ipAddress?: string;
  userAgent?: string;
}

interface Recipient {
  email: null | string;
  firstName: string;
}

const footer =
  'If this was not you, reset your password immediately and contact your administrator.';

export const makeSecurityNoticeService = (d: Pick<AppDeps, 'logger' | 'mail'>) => {
  const { logger, mail } = d;

  const send = async (recipient: Recipient, subject: string, lines: string[]): Promise<void> => {
    if (!recipient.email) return;
    try {
      await mail.send({
        email: recipient.email,
        subject,
        text: `Hi ${recipient.firstName},\n\n${lines.join('\n')}\n\n${footer}\n\n- Elektor Pro`,
      });
    } catch (error) {
      // Best-effort: the security action already succeeded.
      logger.error({ error, subject }, 'Security notice email failed');
    }
  };

  const describeDevice = (ctx: NoticeContext): string =>
    [ctx.ipAddress && `IP ${ctx.ipAddress}`, ctx.userAgent].filter(Boolean).join(', ') ||
    'an unrecognized device';

  return {
    emailChanged: (recipient: Recipient, newEmail: string) =>
      send(recipient, 'Your email address was changed', [
        `The email on your Elektor Pro account was changed to ${newEmail}.`,
      ]),
    newLogin: (recipient: Recipient, ctx: NoticeContext) =>
      send(recipient, 'New sign-in to your account', [
        `Your Elektor Pro account was just signed in to from ${describeDevice(ctx)}.`,
      ]),
    passwordChanged: (recipient: Recipient) =>
      send(recipient, 'Your password was changed', [
        'The password on your Elektor Pro account was just changed.',
        'All other signed-in devices have been signed out.',
      ]),
    phoneChanged: (recipient: Recipient, newPhone: string) =>
      send(recipient, 'Your phone number was changed', [
        `The phone number on your Elektor Pro account was changed to ${newPhone}.`,
      ]),
    twoFactorDisabled: (recipient: Recipient) =>
      send(recipient, 'Two-factor authentication disabled', [
        'Two-factor authentication was turned OFF for your Elektor Pro account.',
      ]),
    twoFactorEnabled: (recipient: Recipient, method: string) =>
      send(recipient, 'Two-factor authentication enabled', [
        `Two-factor authentication (${method}) was turned on for your Elektor Pro account.`,
      ]),
  };
};

export type SecurityNoticeService = ReturnType<typeof makeSecurityNoticeService>;
