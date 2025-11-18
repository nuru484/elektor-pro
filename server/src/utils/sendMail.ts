import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createEmailTransporter } from './email-transporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EmailOptions {
  email: string;
  subject: string;
  template?: string;
  data?: { [key: string]: unknown };
  text?: string;
}

const transporter = createEmailTransporter();

const sendMail = async (options: EmailOptions): Promise<void> => {
  const { email, subject, template, data, text } = options;

  let html = '';

  if (template && data) {
    const templatePath = path.join(__dirname, '../ejs', template);
    html = await ejs.renderFile(templatePath, data);
  }

  const mailOptions = {
    from: process.env.SMTP_MAIL,
    to: email,
    subject,
    html: html || undefined,
    text: text || undefined,
  };

  await transporter.sendMail(mailOptions);
};

export default sendMail;
