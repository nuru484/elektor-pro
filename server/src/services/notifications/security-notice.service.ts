import type { EmailOptions } from '../../utils/sendMail.js';
// src/services/notifications/security-notice.service.ts
//
// Security notification emails: fired on account-security events (password
// changed, 2FA toggled, contact changed, new sign-in).
//
// These go on the mail queue rather than out inline. Nobody is waiting on
// them, so they must never fail the security action that produced them - but
// they are also the only warning an account holder gets that someone else
// changed their password, so losing one to a transient provider error is not
// acceptable either. The queue gives both: the action returns immediately,
// and delivery retries on its own schedule.
import type { AppDeps } from '../deps.js';

import {
  buildEmailChangedEmail,
  buildNewLoginEmail,
  buildPasswordChangedEmail,
  buildPhoneChangedEmail,
  buildTwoFactorDisabledEmail,
  buildTwoFactorEnabledEmail,
} from '../../mail/account-emails.js';

interface NoticeContext {
  ipAddress?: string;
  userAgent?: string;
}

interface Recipient {
  email: null | string;
  firstName: string;
}

export const makeSecurityNoticeService = (d: Pick<AppDeps, 'queueMail'>) => {
  const send = async (
    recipient: Recipient,
    build: (name: string) => Omit<EmailOptions, 'email'>,
  ): Promise<void> => {
    if (!recipient.email) return;
    await d.queueMail.enqueue({
      ...build(recipient.firstName),
      email: recipient.email,
    });
  };

  const describeDevice = (ctx: NoticeContext): string =>
    [ctx.ipAddress && `IP ${ctx.ipAddress}`, ctx.userAgent].filter(Boolean).join(', ') ||
    'an unrecognized device';

  return {
    emailChanged: (recipient: Recipient, newEmail: string) =>
      send(recipient, (name) => buildEmailChangedEmail(name, newEmail)),
    newLogin: (recipient: Recipient, ctx: NoticeContext) =>
      send(recipient, (name) => buildNewLoginEmail(name, describeDevice(ctx))),
    passwordChanged: (recipient: Recipient) =>
      send(recipient, (name) => buildPasswordChangedEmail(name)),
    phoneChanged: (recipient: Recipient, newPhone: string) =>
      send(recipient, (name) => buildPhoneChangedEmail(name, newPhone)),
    twoFactorDisabled: (recipient: Recipient) =>
      send(recipient, (name) => buildTwoFactorDisabledEmail(name)),
    twoFactorEnabled: (recipient: Recipient, method: string) =>
      send(recipient, (name) => buildTwoFactorEnabledEmail(name, method)),
  };
};

export type SecurityNoticeService = ReturnType<typeof makeSecurityNoticeService>;
