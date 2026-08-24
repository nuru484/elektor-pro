// src/mail/auth-emails.ts
//
// Builders for the emails somebody is waiting on: sign-in codes, reset links,
// address confirmations. Each returns the send options minus the recipient, so
// a service adds `email` and hands the whole thing to the mailer - keeping the
// copy in one place and the services assertable in tests.
//
// Every builder ships a plain-text `text` alongside the template data: clients
// that refuse HTML, and gateways that strip it, still get the code or link.
import type { EmailOptions } from '../utils/sendMail.js';

export type BuiltEmail = Omit<EmailOptions, 'email'>;

const TEMPLATE = 'message.ejs';

const IGNORE_NOTE = 'Did not request this? You can ignore this email.';

/** Second factor at staff sign-in. */
export const buildSignInCodeEmail = (
  name: string,
  code: string,
  ttlMinutes: number,
): BuiltEmail => ({
  data: {
    code,
    codeNote: `Expires in ${String(ttlMinutes)} minutes.`,
    intro: ['Use this code to finish signing in.'],
    name,
    note: IGNORE_NOTE,
    preview: `Your sign-in code expires in ${String(ttlMinutes)} minutes.`,
    title: 'Your sign-in code',
  },
  subject: 'Your Elektor Pro sign-in code',
  template: TEMPLATE,
  text: `Your sign-in code is ${code}. It expires in ${String(ttlMinutes)} minutes.`,
});

/** Confirmation code before email two-factor is switched on. */
export const buildTwoFactorSetupEmail = (
  name: string,
  code: string,
  ttlMinutes: number,
): BuiltEmail => ({
  data: {
    code,
    codeNote: `Expires in ${String(ttlMinutes)} minutes.`,
    intro: ['Use this code to turn on two-factor authentication by email.'],
    name,
    note: IGNORE_NOTE,
    preview: `Your confirmation code expires in ${String(ttlMinutes)} minutes.`,
    title: 'Confirm email two-factor authentication',
  },
  subject: 'Confirm email two-factor authentication',
  template: TEMPLATE,
  text: `Your confirmation code is ${code}. It expires in ${String(ttlMinutes)} minutes.`,
});

/** Password-reset link. */
export const buildPasswordResetEmail = (
  name: string,
  link: string,
  ttlMinutes: number,
): BuiltEmail => ({
  data: {
    action: { label: 'Reset password', url: link },
    intro: [
      `Set a new password using the button below. The link works for ${String(ttlMinutes)} minutes.`,
    ],
    name,
    note: 'Did not request this? Your password stays as it is.',
    preview: `Reset your password within ${String(ttlMinutes)} minutes.`,
    title: 'Reset your password',
  },
  subject: 'Reset your Elektor Pro password',
  template: TEMPLATE,
  text: `Reset your password using this link (valid for ${String(ttlMinutes)} minutes): ${link}`,
});

/** Confirmation code for an address the account holder is adding themselves. */
export const buildEmailChangeEmail = (
  name: string,
  code: string,
  ttlMinutes: number,
): BuiltEmail => ({
  data: {
    code,
    codeNote: `Expires in ${String(ttlMinutes)} minutes.`,
    intro: ['Use this code to confirm this address on your account.'],
    name,
    note: 'Until you confirm, your account keeps its current email address.',
    preview: `Confirm your new email address within ${String(ttlMinutes)} minutes.`,
    title: 'Confirm your new email address',
  },
  subject: 'Confirm your new email address',
  template: TEMPLATE,
  text: `Your Elektor Pro confirmation code is ${code}. It expires in ${String(ttlMinutes)} minutes.`,
});

/** The same confirmation, for an address an administrator is staging. */
export const buildAdminEmailChangeEmail = (
  code: string,
  ttlMinutes: number,
): BuiltEmail => ({
  data: {
    code,
    codeNote: `Expires in ${String(ttlMinutes)} minutes.`,
    intro: [
      'An administrator is setting this address on an Elektor Pro account. Use this code to confirm it belongs to you.',
    ],
    note: 'Not expecting this? The address is not used until the code is entered.',
    preview: `Confirmation code expires in ${String(ttlMinutes)} minutes.`,
    title: 'Confirm this email address',
  },
  subject: 'Confirm this email for your Elektor Pro account',
  template: TEMPLATE,
  text: `An administrator is setting this email on an Elektor Pro account. Confirmation code: ${code}. It expires in ${String(ttlMinutes)} minutes.`,
});
