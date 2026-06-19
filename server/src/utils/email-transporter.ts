// src/utils/email.ts
import nodemailer from 'nodemailer';

import ENV from '../config/env.js';

// Configure nodemailer transporter for Gmail
export const createEmailTransporter = () => {
  return nodemailer.createTransport({
    auth: {
      pass: ENV.GMAIL_PASSWORD,
      user: ENV.GMAIL_USER,
    },
    host: ENV.SMTP_HOST,
    port: ENV.SMTP_PORT,
    service: 'gmail',
  });
};


