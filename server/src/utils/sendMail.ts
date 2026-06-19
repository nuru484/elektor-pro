import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createEmailTransporter } from './email-transporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EmailOptions {
  data?: Record<string, unknown>;
  email: string;
  subject: string;
  template?: string;
  text?: string;
}

const transporter = createEmailTransporter();

const sendMail = async (options: EmailOptions): Promise<void> => {
  const { data, email, subject, template, text } = options;

  let html = '';

  if (template && data) {
    const templatePath = path.join(__dirname, '../ejs', template);
    html = await ejs.renderFile(templatePath, data);
  }

  const mailOptions = {
    from: process.env.SMTP_MAIL,
    html: html || undefined,
    subject,
    text: text || undefined,
    to: email,
  };

  await transporter.sendMail(mailOptions);
};

export default sendMail;
