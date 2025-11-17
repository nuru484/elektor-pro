import nodemailer from 'nodemailer';
import ENV from './env.js';

export default nodemailer.createTransport({
  host: ENV.EMAIL_HOST,
  port: ENV.EMAIL_PORT,
  secure: ENV.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: ENV.EMAIL_USER,
    pass: ENV.EMAIL_PASS,
  },
});
