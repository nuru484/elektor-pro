// src/utils/sendMail.ts
//
// Email delivery via the Resend HTTP API (SMTP is blocked on some hosts,
// e.g. Render's free tier). In mock mode (no RESEND_API_KEY configured -
// dev, CI, tests) the message is logged instead of sent, mirroring the SMS
// service's mock behavior, so flows that email codes/notices work
// end-to-end locally.
import { Resend } from 'resend';

import ENV from '../config/env.js';
import { renderTemplate } from '../mail/render-template.js';
import logger from './logger.js';

export interface EmailOptions {
  data?: Record<string, unknown>;
  email: string;
  subject: string;
  template?: string;
  text?: string;
}

const mailConfigured = Boolean(ENV.RESEND_API_KEY);

const resend = mailConfigured ? new Resend(ENV.RESEND_API_KEY) : null;

const sendMail = async (options: EmailOptions): Promise<void> => {
  const { data, email, subject, template, text } = options;

  const html = template && data ? await renderTemplate(template, data) : '';

  if (!resend) {
    logger.info({ subject, text, to: email }, '[Mail mock] message not actually sent');
    return;
  }

  // Resend's request type demands a definite html or text body, so pick the
  // branch instead of passing undefined fields.
  const base = { from: ENV.MAIL_FROM, subject, to: email };
  const { error } =
    html === ''
      ? await resend.emails.send({ ...base, text: text ?? '' })
      : await resend.emails.send({ ...base, html, text });

  // Resend reports failures as a result value; surface them as a throw so
  // callers (and the email queue's retries) treat them like any send failure.
  if (error) {
    throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
};

export default sendMail;
