// src/mail/account-emails.ts
//
// Account provisioning and account-security email. Neither kind is worth
// failing an action over - the account is already created, the password is
// already changed - so both go on the mail queue and retry there.
import type { BuiltEmail } from './auth-emails.js';

const TEMPLATE = 'message.ejs';

const SECURITY_FOOTER =
  'Was this not you? Reset your password and contact your administrator.';

/** Temporary password for an account someone else created. */
export const buildCredentialsEmail = (
  name: string,
  temporaryPassword: string,
  signInUrl: string,
  opts: { candidate?: boolean; identifier?: string } = {},
): BuiltEmail => {
  const what = opts.candidate
    ? 'You have been nominated, and a candidate account is ready for you.'
    : 'An account has been created for you.';
  const signInWith = opts.identifier ?? 'your email address';

  return {
    data: {
      action: { label: 'Sign in', url: signInUrl },
      intro: [what],
      name,
      note: 'You will be asked to set your own password at first sign-in.',
      preview: 'Your temporary password is inside.',
      rows: [
        { label: 'Sign in with', value: signInWith },
        { label: 'Temporary password', value: temporaryPassword },
      ],
      rowsCaption: 'Your credentials',
      title: opts.candidate
        ? 'Your candidate account is ready'
        : 'Your account is ready',
    },
    subject: opts.candidate
      ? 'Your Elektor Pro candidate account'
      : 'Your Elektor Pro account',
    template: TEMPLATE,
    text:
      `Hello ${name},\n\n${what}\n\n` +
      `Sign in with: ${signInWith}\n` +
      `Temporary password: ${temporaryPassword}\n\n` +
      'You will be asked to set your own password at first sign-in.',
  };
};

/**
 * One account-security notice: what happened, in the recipient's own words,
 * with the standing instruction underneath. Callers below name the event.
 */
const securityNotice = (
  name: string,
  title: string,
  subject: string,
  lines: string[],
): BuiltEmail => ({
  data: {
    intro: lines,
    name,
    note: SECURITY_FOOTER,
    preview: subject,
    title,
  },
  subject,
  template: TEMPLATE,
  text: `Hi ${name},\n\n${lines.join('\n')}\n\n${SECURITY_FOOTER}\n\n- Elektor Pro`,
});

export const buildPasswordChangedEmail = (name: string): BuiltEmail =>
  securityNotice(name, 'Your password was changed', 'Your password was changed', [
    'The password on your Elektor Pro account was just changed.',
    'All other signed-in devices have been signed out.',
  ]);

export const buildTwoFactorEnabledEmail = (
  name: string,
  method: string,
): BuiltEmail =>
  securityNotice(
    name,
    'Two-factor authentication is on',
    'Two-factor authentication enabled',
    [`Two-factor authentication (${method}) was turned on for your Elektor Pro account.`],
  );

export const buildTwoFactorDisabledEmail = (name: string): BuiltEmail =>
  securityNotice(
    name,
    'Two-factor authentication is off',
    'Two-factor authentication disabled',
    ['Two-factor authentication was turned OFF for your Elektor Pro account.'],
  );

export const buildEmailChangedEmail = (
  name: string,
  newEmail: string,
): BuiltEmail =>
  securityNotice(
    name,
    'Your email address was changed',
    'Your email address was changed',
    [`The email on your Elektor Pro account was changed to ${newEmail}.`],
  );

export const buildPhoneChangedEmail = (
  name: string,
  newPhone: string,
): BuiltEmail =>
  securityNotice(
    name,
    'Your phone number was changed',
    'Your phone number was changed',
    [`The phone number on your Elektor Pro account was changed to ${newPhone}.`],
  );

export const buildNewLoginEmail = (name: string, device: string): BuiltEmail =>
  securityNotice(name, 'New sign-in to your account', 'New sign-in to your account', [
    `Your Elektor Pro account was just signed in to from ${device}.`,
  ]);
