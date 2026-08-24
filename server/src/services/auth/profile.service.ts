// src/services/auth/profile.service.ts
//
// Self-service profile for every role: names, verified email change, verified
// phone change, and profile photo. Contact changes are two-step: the new
// value is held on pendingEmail/pendingPhone until a code sent to THAT
// address/number confirms ownership - so nobody can point an account at a
// contact they don't control.
import { OtpPurpose } from '../../../generated/prisma/client.js';
import { buildEmailChangeEmail } from '../../mail/auth-emails.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { validateAndFormatPhone } from '../../utils/validate-phone.js';
import { appendAudit } from '../audit/audit.service.js';
import { type AppDeps, defaultDeps } from '../deps.js';
import { makeSecurityNoticeService } from '../notifications/security-notice.service.js';
import { type RequestContext, STAFF_SELECT } from './auth.service.js';
import { makeOtpService } from './otp.service.js';

export interface ProfileUpdateInput {
  firstName?: string;
  lastName?: string;
}

export const makeProfileService = (
  d: Pick<
    AppDeps,
    | 'clock'
    | 'cloudinary'
    | 'config'
    | 'logger'
    | 'mail'
    | 'prisma'
    | 'queueMail'
    | 'sms'
  >,
) => {
  const { clock, prisma } = d;
  const otp = makeOtpService(d);
  const notices = makeSecurityNoticeService(d);

  const requireUser = async (userId: string) => {
    const user = await prisma.user.findUnique({
      select: {
        email: true,
        firstName: true,
        id: true,
        pendingEmail: true,
        pendingPhone: true,
        phone: true,
        profilePicture: true,
        role: true,
      },
      where: { id: userId },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  };

  /** Update the editable identity fields (names). */
  const updateProfile = async (
    userId: string,
    input: ProfileUpdateInput,
    ctx: RequestContext,
  ) => {
    const user = await requireUser(userId);
    const updated = await prisma.user.update({
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      },
      select: STAFF_SELECT,
      where: { id: userId },
    });
    await appendAudit(prisma, {
      action: 'profile.updated',
      actorId: userId,
      actorRole: user.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return updated;
  };

  /** Step 1 of an email change: hold the new address, code sent to it. */
  const requestEmailChange = async (
    userId: string,
    newEmailRaw: string,
  ): Promise<{ email: string; ttlMinutes: number }> => {
    const newEmail = newEmailRaw.toLowerCase().trim();
    const user = await requireUser(userId);
    if (user.email === newEmail) {
      throw new BadRequestError('That is already your email address');
    }
    const taken = await prisma.user.findUnique({
      select: { id: true },
      where: { email: newEmail },
    });
    if (taken) throw new ConflictError('That email address is already in use');

    await prisma.user.update({
      data: { pendingEmail: newEmail },
      where: { id: userId },
    });
    const issued = await otp.issue(userId, OtpPurpose.EMAIL_CHANGE);
    await d.mail.send({
      ...buildEmailChangeEmail(user.firstName, issued.code, issued.ttlMinutes),
      email: newEmail,
    });
    return { email: newEmail, ttlMinutes: issued.ttlMinutes };
  };

  /** Step 2: the code proves ownership; the change applies + is announced. */
  const confirmEmailChange = async (
    userId: string,
    code: string,
    ctx: RequestContext,
  ) => {
    const user = await requireUser(userId);
    if (!user.pendingEmail) {
      throw new BadRequestError('No email change in progress');
    }
    await otp.verify(userId, OtpPurpose.EMAIL_CHANGE, code);

    const previousEmail = user.email;
    const updated = await prisma.user.update({
      data: {
        email: user.pendingEmail,
        emailVerifiedAt: clock.now(),
        pendingEmail: null,
      },
      select: STAFF_SELECT,
      where: { id: userId },
    });
    await appendAudit(prisma, {
      action: 'profile.email_changed',
      actorId: userId,
      actorRole: user.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      metadata: { newEmail: user.pendingEmail },
      userAgent: ctx.userAgent,
    });
    // Warn the OLD address - the one a hijacker wouldn't control.
    if (previousEmail) {
      await notices.emailChanged(
        { email: previousEmail, firstName: user.firstName },
        user.pendingEmail,
      );
    }
    return updated;
  };

  /** Step 1 of a phone change: hold the new number, SMS code sent to it. */
  const requestPhoneChange = async (
    userId: string,
    newPhoneRaw: string,
  ): Promise<{ phone: string; ttlMinutes: number }> => {
    const newPhone = validateAndFormatPhone(newPhoneRaw, 'GH').e164Format;
    const user = await requireUser(userId);
    if (user.phone === newPhone) {
      throw new BadRequestError('That is already your phone number');
    }
    const taken = await prisma.user.findUnique({
      select: { id: true },
      where: { phone: newPhone },
    });
    if (taken) throw new ConflictError('That phone number is already in use');

    await prisma.user.update({
      data: { pendingPhone: newPhone },
      where: { id: userId },
    });
    const issued = await otp.issue(userId, OtpPurpose.PHONE_CHANGE);
    await d.sms.send(
      newPhone,
      `Your Elektor Pro confirmation code is ${issued.code}. It expires in ${issued.ttlMinutes} minutes.`,
    );
    return { phone: newPhone, ttlMinutes: issued.ttlMinutes };
  };

  const confirmPhoneChange = async (
    userId: string,
    code: string,
    ctx: RequestContext,
  ) => {
    const user = await requireUser(userId);
    if (!user.pendingPhone) {
      throw new BadRequestError('No phone change in progress');
    }
    await otp.verify(userId, OtpPurpose.PHONE_CHANGE, code);

    const updated = await prisma.user.update({
      data: {
        pendingPhone: null,
        phone: user.pendingPhone,
        phoneVerifiedAt: clock.now(),
      },
      select: STAFF_SELECT,
      where: { id: userId },
    });
    await appendAudit(prisma, {
      action: 'profile.phone_changed',
      actorId: userId,
      actorRole: user.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      metadata: { newPhone: user.pendingPhone },
      userAgent: ctx.userAgent,
    });
    await notices.phoneChanged(user, user.pendingPhone);
    return updated;
  };

  /** Upload a new profile photo; the previous one is cleaned up best-effort. */
  const updateProfilePicture = async (
    userId: string,
    image: { buffer: Buffer; mimetype?: string },
    ctx: RequestContext,
  ) => {
    const user = await requireUser(userId);
    const uploaded = await d.cloudinary.uploadImage(image, {
      folder: 'elektor-pro/profiles',
    });
    const updated = await prisma.user.update({
      data: { profilePicture: uploaded.secure_url },
      select: STAFF_SELECT,
      where: { id: userId },
    });
    if (user.profilePicture && user.profilePicture !== uploaded.secure_url) {
      try {
        await d.cloudinary.deleteImage(user.profilePicture);
      } catch (error) {
        d.logger.warn({ error, userId }, 'Old profile picture cleanup failed');
      }
    }
    await appendAudit(prisma, {
      action: 'profile.picture_updated',
      actorId: userId,
      actorRole: user.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return updated;
  };

  return {
    confirmEmailChange,
    confirmPhoneChange,
    requestEmailChange,
    requestPhoneChange,
    updateProfile,
    updateProfilePicture,
  };
};

export type ProfileService = ReturnType<typeof makeProfileService>;

export const profileService = makeProfileService(defaultDeps);
