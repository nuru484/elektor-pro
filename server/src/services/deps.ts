// src/services/deps.ts
//
// Central dependency wiring for the service layer. Every service is a factory
// `makeXService(deps)` that receives its collaborators here instead of
// importing them directly, so unit tests can pass fakes for SMS / mail /
// Cloudinary / the clock while keeping the real (test-DB) Prisma client.
//
// `defaultDeps` is the production wiring; controllers import the default-wired
// singletons, so they need no knowledge of this indirection.
import type sendMailFn from '../utils/sendMail.js';

import { cloudinaryService } from '../config/cloudinary.js';
import ENV from '../config/env.js';
import { type Clock, systemClock } from '../lib/clock.js';
import prismaClient from '../lib/prisma.js';
import { sendSms } from '../services/notifications/sms.service.js';
import loggerInstance from '../utils/logger.js';
import sendMail from '../utils/sendMail.js';

/** Config values services read; injected so tests can vary them. */
export interface AppConfig {
  FRONTEND_URL: string;
  OTP_LENGTH: number;
  OTP_MODE: 'live' | 'mock';
  OTP_TTL_MINUTES: number;
}
export interface AppDeps {
  clock: Clock;
  cloudinary: CloudinaryClient;
  config: AppConfig;
  logger: Logger;
  mail: MailClient;
  prisma: DbClient;
  sms: SmsClient;
}

/** Cloudinary image I/O surface; injected so tests upload/delete without network. */
export interface CloudinaryClient {
  deleteImage: typeof cloudinaryService.deleteImage;
  uploadImage: typeof cloudinaryService.uploadImage;
}

export type DbClient = typeof prismaClient;

export type Logger = typeof loggerInstance;

/** Email I/O surface; injected so tests never hit SMTP. */
export interface MailClient {
  send: typeof sendMailFn;
}

/** SMS I/O surface; injected so tests never hit the gateway. */
export interface SmsClient {
  send: typeof sendSms;
}

export const defaultDeps: AppDeps = {
  clock: systemClock,
  cloudinary: {
    deleteImage: cloudinaryService.deleteImage.bind(cloudinaryService),
    uploadImage: cloudinaryService.uploadImage.bind(cloudinaryService),
  },
  config: {
    FRONTEND_URL: ENV.FRONTEND_URL,
    OTP_LENGTH: ENV.OTP_LENGTH,
    OTP_MODE: ENV.OTP_MODE,
    OTP_TTL_MINUTES: ENV.OTP_TTL_MINUTES,
  },
  logger: loggerInstance,
  mail: { send: sendMail },
  prisma: prismaClient,
  sms: { send: sendSms },
};
