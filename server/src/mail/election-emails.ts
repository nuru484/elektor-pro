// src/mail/election-emails.ts
//
// Voter-facing email: the code that opens a ballot, and the announcements a
// roll receives when voting opens and when results are published.
import type { BuiltEmail } from './auth-emails.js';

const TEMPLATE = 'message.ejs';

/** The code a voter needs to reach their ballot. */
export const buildVoterCodeEmail = (
  code: string,
  ttlMinutes: number,
): BuiltEmail => ({
  data: {
    code,
    codeNote: `Expires in ${String(ttlMinutes)} minutes.`,
    intro: ['Use this code to open your ballot.'],
    note: 'Did not ask to vote just now? You can ignore this email.',
    preview: `Your voting code expires in ${String(ttlMinutes)} minutes.`,
    title: 'Your verification code',
  },
  subject: 'Your Elektor Pro verification code',
  template: TEMPLATE,
  text: `Your Elektor Pro verification code is ${code}. It expires in ${String(ttlMinutes)} minutes.`,
});

/**
 * An announcement to one voter. The queue carries the subject and the body
 * the announcement service composed, so both announcements - voting opened,
 * results published - render through the same shell.
 */
export const buildAnnouncementEmail = (
  name: string,
  subject: string,
  text: string,
  link?: string,
): BuiltEmail => ({
  data: {
    ...(link ? { action: { label: 'Open Elektor Pro', url: link } } : {}),
    intro: [text],
    name,
    preview: subject,
    title: subject,
  },
  subject,
  template: TEMPLATE,
  text: `Hello ${name},\n\n${text}`,
});
