import { OtpPurpose, Role } from '../../../generated/prisma/client.js';
import ENV from '../../config/env.js';
// src/services/voting/voter-auth.service.ts
// Voter authentication via phone OTP (mock-logged in dev, FROG SMS in live).
import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import { generateNumericCode, safeEqual, sha256 } from '../../utils/crypto.js';
import { appendAudit } from '../audit/audit.service.js';
import { sendSms } from '../notifications/sms.service.js';

const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_WINDOW_MS = 60 * 1000;

const maskPhone = (phone: string): string =>
  phone.length <= 4 ? phone : `${phone.slice(0, 4)}****${phone.slice(-2)}`;

const findVoterByIdentifier = (identifier: string) =>
  prisma.voter.findFirst({
    where: {
      OR: [{ voterId: identifier }, { phoneNumber: identifier }],
    },
  });

/** Ensure the voter has a linked User(VOTER) account; create lazily. */
const ensureVoterUser = async (voter: {
  id: string;
  name: string;
  phoneNumber: null | string;
  userId: null | string;
}): Promise<string> => {
  if (voter.userId) return voter.userId;
  const [firstName, ...rest] = voter.name.trim().split(/\s+/);
  const user = await prisma.user.create({
    data: {
      firstName: firstName ?? voter.name,
      lastName: rest.join(' ') || '-',
      phone: voter.phoneNumber,
      role: Role.VOTER,
    },
    select: { id: true },
  });
  await prisma.voter.update({
    data: { userId: user.id },
    where: { id: voter.id },
  });
  return user.id;
};

export interface OtpRequestResult {
  devCode?: string;
  expiresInMinutes: number;
  phoneMasked: string;
}

export const requestVoterOtp = async (
  identifier: string,
): Promise<OtpRequestResult> => {
  const voter = await findVoterByIdentifier(identifier);
  if (!voter) throw new NotFoundError('Voter not found');
  if (!voter.phoneNumber) {
    throw new BadRequestError('No phone number on record. Contact an administrator.');
  }

  const userId = await ensureVoterUser(voter);

  const recent = await prisma.otp.findFirst({
    orderBy: { createdAt: 'desc' },
    where: { purpose: OtpPurpose.VOTER_LOGIN, userId },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < OTP_RESEND_WINDOW_MS) {
    throw new TooManyRequestsError('Please wait before requesting another code');
  }

  const code = generateNumericCode(ENV.OTP_LENGTH);
  const expiresAt = new Date(Date.now() + ENV.OTP_TTL_MINUTES * 60 * 1000);
  await prisma.otp.create({
    data: { codeHash: sha256(code), expiresAt, userId },
  });

  await sendSms(
    voter.phoneNumber,
    `Your Elektor Pro verification code is ${code}. It expires in ${ENV.OTP_TTL_MINUTES} minutes.`,
  );

  return {
    expiresInMinutes: ENV.OTP_TTL_MINUTES,
    phoneMasked: maskPhone(voter.phoneNumber),
    // Surface the code in mock mode so dev/test never needs a real SMS.
    ...(ENV.OTP_MODE === 'mock' ? { devCode: code } : {}),
  };
};

export const verifyVoterOtp = async (
  identifier: string,
  code: string,
  ctx: { ipAddress?: string; userAgent?: string },
): Promise<{ userId: string; voterId: string }> => {
  const voter = await findVoterByIdentifier(identifier);
  if (!voter?.userId) throw new UnauthorizedError('Invalid code');

  const otp = await prisma.otp.findFirst({
    orderBy: { createdAt: 'desc' },
    where: {
      consumedAt: null,
      purpose: OtpPurpose.VOTER_LOGIN,
      userId: voter.userId,
    },
  });
  if (!otp || otp.expiresAt < new Date()) {
    throw new UnauthorizedError('Code expired. Request a new one.');
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    throw new TooManyRequestsError('Too many attempts. Request a new code.');
  }

  if (!safeEqual(otp.codeHash, sha256(code.trim()))) {
    await prisma.otp.update({
      data: { attempts: { increment: 1 } },
      where: { id: otp.id },
    });
    throw new UnauthorizedError('Invalid code');
  }

  await prisma.otp.update({
    data: { consumedAt: new Date() },
    where: { id: otp.id },
  });
  await appendAudit(prisma, {
    action: 'voter.login',
    actorId: voter.userId,
    actorRole: Role.VOTER,
    entity: 'Voter',
    entityId: voter.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return { userId: voter.userId, voterId: voter.id };
};
