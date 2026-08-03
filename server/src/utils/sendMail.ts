// src/utils/sendMail.ts
//
// Email delivery. In mock mode (no SMTP credentials configured - dev, CI,
// tests) the message is logged instead of sent, mirroring the SMS service's
// mock behavior, so flows that email codes/notices work end-to-end locally.
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';

import ENV from '../config/env.js';
import { createEmailTransporter } from './email-transporter.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EmailOptions {
  data?: Record<string, unknown>;
  email: string;
  subject: string;
  template?: string;
  text?: string;
}

const mailConfigured = Boolean(ENV.GMAIL_USER && ENV.GMAIL_PASSWORD);

const transporter = mailConfigured ? createEmailTransporter() : null;

const sendMail = async (options: EmailOptions): Promise<void> => {
  const { data, email, subject, template, text } = options;

  let html = '';

  if (template && data) {
    const templatePath = path.join(__dirname, '../ejs', template);
    html = await ejs.renderFile(templatePath, data);
  }

  if (!transporter) {
    logger.info({ subject, text, to: email }, '[Mail mock] message not actually sent');
    return;
  }

  await transporter.sendMail({
    from: ENV.SMTP_MAIL,
    html: html === '' ? undefined : html,
    subject,
    text: text === '' ? undefined : text,
    to: email,
  });
};

export default sendMail;
