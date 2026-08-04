// src/services/voting/voter-auth.service.ts
// Voter authentication via one-time codes. Primary channel is SMS (mock-
// logged in dev, FROG in live); voters without a phone on record fall back to
// their email. Factory-built so tests inject a frozen clock + fake channels.
import { OtpPurpose, Role } from '../../../generated/prisma/client.js';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import { validateAndFormatPhone } from '../../utils/validate-phone.js';
import { appendAudit } from '../audit/audit.service.js';
import { makeOtpService } from '../auth/otp.service.js';
import { type AppDeps, defaultDeps } from '../deps.js';

const maskPhone = (phone: string): string =>
  phone.length <= 4 ? phone : `${phone.slice(0, 4)}****${phone.slice(-2)}`;

const maskEmail = (email: string): string => {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
};

export interface OtpRequestResult {
  channel: 'email' | 'sms';
  destinationMasked: string;
  devCode?: string;
  expiresInMinutes: number;
  /** @deprecated kept for older clients; same value as destinationMasked. */
  phoneMasked: string;
}

export const makeVoterAuthService = (
  d: Pick<AppDeps, 'clock' | 'config' | 'logger' | 'mail' | 'prisma' | 'sms'>,
) => {
  const { config, prisma } = d;
  const otp = makeOtpService(d);

  const findVoterByIdentifier = (identifier: string) => {
    // Contact is stored canonically (lowercase email, E.164 phone), so the
    // typed identifier is normalised the same way before matching - a voter
    // registered as +233240000001 can sign in typing "024 000 0001".
    const trimmed = identifier.trim();
    const candidates = new Set([trimmed, trimmed.toLowerCase()]);
    try {
      candidates.add(validateAndFormatPhone(trimmed, 'GH').e164Format);
    } catch {
      // Not a phone number; the other candidates still match voterId/email.
    }
    const values = [...candidates];
    return prisma.voter.findFirst({
      where: {
        OR: [
          { voterId: { in: values } },
          { phoneNumber: { in: values } },
          { email: { in: values } },
        ],
      },
    });
  };

  /** Ensure the voter has a linked User(VOTER) account; create lazily. */
  const ensureVoterUser = async (voter: {
    email: null | string;
    id: string;
    name: string;
    phoneNumber: null | string;
    userId: null | string;
  }): Promise<string> => {
    if (voter.userId) return voter.userId;
    const [firstName, ...rest] = voter.name.trim().split(/\s+/);
    const user = await prisma.user.create({
      data: {
        firstName,
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

  const requestVoterOtp = async (identifier: string): Promise<OtpRequestResult> => {
    const voter = await findVoterByIdentifier(identifier);
    if (!voter) throw new NotFoundError('Voter not found');
    if (!voter.phoneNumber && !voter.email) {
      throw new BadRequestError(
        'No phone number or email on record. Contact an administrator.',
      );
    }

    const userId = await ensureVoterUser(voter);
    const issued = await otp.issue(userId, OtpPurpose.VOTER_LOGIN);
    const message = `Your Elektor Pro verification code is ${issued.code}. It expires in ${issued.ttlMinutes} minutes.`;

    let channel: 'email' | 'sms';
    let destinationMasked: string;
    if (voter.phoneNumber) {
      channel = 'sms';
      destinationMasked = maskPhone(voter.phoneNumber);
      await d.sms.send(voter.phoneNumber, message);
    } else if (voter.email) {
      channel = 'email';
      destinationMasked = maskEmail(voter.email);
      await d.mail.send({
        email: voter.email,
        subject: 'Your Elektor Pro verification code',
        text: message,
      });
    } else {
      // Unreachable (guarded above); typed for exhaustiveness.
      throw new BadRequestError('No delivery channel available');
    }

    return {
      channel,
      destinationMasked,
      expiresInMinutes: issued.ttlMinutes,
      phoneMasked: destinationMasked,
      // Surface the code in mock mode so dev/test never needs a real send.
      ...(config.OTP_MODE === 'mock' ? { devCode: issued.code } : {}),
    };
  };

  const verifyVoterOtp = async (
    identifier: string,
    code: string,
    ctx: { ipAddress?: string; userAgent?: string },
  ): Promise<{ userId: string; voterId: string }> => {
    const voter = await findVoterByIdentifier(identifier);
    if (!voter?.userId) throw new UnauthorizedError('Invalid code');

    await otp.verify(voter.userId, OtpPurpose.VOTER_LOGIN, code);

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

  return { requestVoterOtp, verifyVoterOtp };
};

export type VoterAuthService = ReturnType<typeof makeVoterAuthService>;

export const voterAuthService = makeVoterAuthService(defaultDeps);
export const { requestVoterOtp, verifyVoterOtp } = voterAuthService;
