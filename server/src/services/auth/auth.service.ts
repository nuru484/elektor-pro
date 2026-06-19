import { Role, Status } from '../../../generated/prisma/client.js';
import { MAX_FAILED_LOGIN_ATTEMPTS } from '../../config/constants.js';
import ENV from '../../config/env.js';
// src/services/auth/auth.service.ts
// Staff/candidate authentication: password login with lockout, TOTP 2FA,
// super-admin unlock, password change/reset, and 2FA enrollment.
import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import {
  decryptSecret,
  encryptSecret,
  generateReceiptCode,
  generateToken,
  safeEqual,
  sha256,
} from '../../utils/crypto.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { validateAndFormatPhone } from '../../utils/validate-phone.js';
import { appendAudit } from '../audit/audit.service.js';
import { sendSms } from '../notifications/sms.service.js';
import {
  buildOtpAuthUrl,
  buildQrDataUrl,
  generateTotpSecret,
  verifyTotp,
} from './totp.service.js';

const PASSWORD_LOGIN_ROLES = new Set<Role>([
  Role.ADMIN,
  Role.AGENT,
  Role.CANDIDATE,
  Role.SUPER_ADMIN,
]);

const RECOVERY_CODE_COUNT = 10;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export const STAFF_SELECT = {
  createdAt: true,
  email: true,
  firstName: true,
  id: true,
  lastLoginAt: true,
  lastName: true,
  phone: true,
  profilePicture: true,
  role: true,
  status: true,
  twoFactorEnabled: true,
  updatedAt: true,
} as const;

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

const isPhone = (value: string): boolean => /^[\d\s+\-()]+$/.test(value);

const findByIdentifier = async (emailOrPhone: string) => {
  let email: string | undefined;
  let phone: string | undefined;
  if (isPhone(emailOrPhone)) {
    phone = validateAndFormatPhone(emailOrPhone, 'GH').e164Format;
  } else {
    email = emailOrPhone.toLowerCase().trim();
  }
  return prisma.user.findFirst({
    select: {
      ...STAFF_SELECT,
      failedLoginAttempts: true,
      lockedAt: true,
      password: true,
      totpSecret: true,
    },
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
  });
};

/**
 * Verify password credentials. Returns an authenticated user, or signals that a
 * 2FA challenge is required. Increments the failed-attempt counter and locks the
 * account on too many failures.
 */
export const authenticateStaff = async (
  emailOrPhone: string,
  password: string,
  ctx: RequestContext,
): Promise<
  | { role: Role; status: 'authenticated'; userId: string; }
  | { status: 'two_factor_required'; userId: string }
> => {
  const user = await findByIdentifier(emailOrPhone);

  // Generic message to avoid user enumeration.
  if (!user || !PASSWORD_LOGIN_ROLES.has(user.role) || !user.password) {
    throw new UnauthorizedError('Invalid credentials');
  }

  if (user.status === Status.LOCKED || user.lockedAt) {
    throw new ForbiddenError(
      'Account locked due to failed logins. Contact a super administrator.',
      { code: 'ACCOUNT_LOCKED' },
    );
  }
  if (user.status === Status.SUSPENDED || user.status === Status.INACTIVE) {
    throw new ForbiddenError('Account is not active', { code: 'ACCOUNT_INACTIVE' });
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
    await prisma.user.update({
      data: {
        failedLoginAttempts: attempts,
        ...(shouldLock
          ? {
              lockedAt: new Date(),
              lockedReason: 'Exceeded maximum failed login attempts',
              status: Status.LOCKED,
            }
          : {}),
      },
      where: { id: user.id },
    });
    await appendAudit(prisma, {
      action: shouldLock ? 'auth.account_locked' : 'auth.login_failed',
      actorId: user.id,
      actorRole: user.role,
      entity: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      metadata: { attempts },
      userAgent: ctx.userAgent,
    });
    throw new UnauthorizedError('Invalid credentials');
  }

  if (user.twoFactorEnabled) {
    return { status: 'two_factor_required', userId: user.id };
  }

  await prisma.user.update({
    data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
    where: { id: user.id },
  });
  await appendAudit(prisma, {
    action: 'auth.login',
    actorId: user.id,
    actorRole: user.role,
    entity: 'User',
    entityId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  return { role: user.role, status: 'authenticated', userId: user.id };
};

/** Complete login by verifying a TOTP code or a recovery code. */
export const verifyStaffTwoFactor = async (
  userId: string,
  code: string,
  ctx: RequestContext,
): Promise<{ role: Role; userId: string }> => {
  const user = await prisma.user.findUnique({
    select: {
      id: true,
      role: true,
      status: true,
      totpSecret: true,
      twoFactorEnabled: true,
    },
    where: { id: userId },
  });
  if (!user || !user.twoFactorEnabled || !user.totpSecret) {
    throw new UnauthorizedError('Two-factor authentication not configured');
  }
  if (user.status !== Status.ACTIVE) {
    throw new ForbiddenError('Account is not active');
  }

  const secret = decryptSecret(user.totpSecret);
  let verified = verifyTotp(code.trim(), secret);

  if (!verified) {
    // Try a single-use recovery code.
    const codeHash = sha256(code.trim().toUpperCase());
    const recovery = await prisma.twoFactorRecoveryCode.findFirst({
      select: { codeHash: true, id: true },
      where: { usedAt: null, userId },
    });
    if (recovery && safeEqual(recovery.codeHash, codeHash)) {
      await prisma.twoFactorRecoveryCode.update({
        data: { usedAt: new Date() },
        where: { id: recovery.id },
      });
      verified = true;
    }
  }

  if (!verified) {
    await appendAudit(prisma, {
      action: 'auth.2fa_failed',
      actorId: userId,
      actorRole: user.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    throw new UnauthorizedError('Invalid authentication code');
  }

  await prisma.user.update({
    data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
    where: { id: userId },
  });
  await appendAudit(prisma, {
    action: 'auth.login_2fa',
    actorId: userId,
    actorRole: user.role,
    entity: 'User',
    entityId: userId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  return { role: user.role, userId };
};

/** Super-admin unlocks a locked account. */
export const unlockAccount = async (
  actor: { id: string; role: Role },
  targetUserId: string,
  ctx: RequestContext,
): Promise<void> => {
  if (actor.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError('Only a super administrator can unlock accounts');
  }
  const target = await prisma.user.findUnique({
    select: { id: true },
    where: { id: targetUserId },
  });
  if (!target) throw new NotFoundError('User not found');

  await prisma.user.update({
    data: {
      failedLoginAttempts: 0,
      lockedAt: null,
      lockedReason: null,
      status: Status.ACTIVE,
      unlockedById: actor.id,
    },
    where: { id: targetUserId },
  });
  await appendAudit(prisma, {
    action: 'auth.account_unlocked',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'User',
    entityId: targetUserId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
  ctx: RequestContext,
): Promise<void> => {
  const user = await prisma.user.findUnique({
    select: { password: true, role: true },
    where: { id: userId },
  });
  if (!user?.password) throw new NotFoundError('User not found');
  if (!(await verifyPassword(currentPassword, user.password))) {
    throw new UnauthorizedError('Current password is incorrect');
  }
  await prisma.user.update({
    data: { password: await hashPassword(newPassword), passwordChangedAt: new Date() },
    where: { id: userId },
  });
  await appendAudit(prisma, {
    action: 'auth.password_changed',
    actorId: userId,
    actorRole: user.role,
    entity: 'User',
    entityId: userId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
};

/** Issue a password-reset token (sent by SMS/email). Never reveals existence. */
export const requestPasswordReset = async (
  emailOrPhone: string,
): Promise<void> => {
  const user = await findByIdentifier(emailOrPhone);
  if (!user || !PASSWORD_LOGIN_ROLES.has(user.role)) return;

  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: {
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      tokenHash: sha256(token),
      userId: user.id,
    },
  });
  const link = `${ENV.CORS_ACCESS.split(',')[0]}/reset-password?token=${token}`;
  if (user.phone) {
    await sendSms(user.phone, `Reset your Elektor Pro password: ${link}`);
  }
};

export const resetPassword = async (
  token: string,
  newPassword: string,
  ctx: RequestContext,
): Promise<void> => {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new BadRequestError('Invalid or expired reset token');
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      data: {
        failedLoginAttempts: 0,
        lockedAt: null,
        password: await hashPassword(newPassword),
        passwordChangedAt: new Date(),
        status: Status.ACTIVE,
      },
      where: { id: record.userId },
    });
    await tx.passwordResetToken.update({
      data: { usedAt: new Date() },
      where: { id: record.id },
    });
  });
  await appendAudit(prisma, {
    action: 'auth.password_reset',
    actorId: record.userId,
    entity: 'User',
    entityId: record.userId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
};

/** Begin 2FA enrollment: store a candidate secret, return the QR + otpauth URL. */
export const setupTwoFactor = async (
  userId: string,
): Promise<{ otpAuthUrl: string; qrCode: string; secret: string }> => {
  const user = await prisma.user.findUnique({
    select: { email: true, firstName: true, twoFactorEnabled: true },
    where: { id: userId },
  });
  if (!user) throw new NotFoundError('User not found');
  if (user.twoFactorEnabled) {
    throw new ConflictError('Two-factor is already enabled');
  }
  const secret = generateTotpSecret();
  const label = user.email ?? user.firstName;
  const otpAuthUrl = buildOtpAuthUrl(secret, label, 'Elektor Pro');
  await prisma.user.update({
    data: { totpSecret: encryptSecret(secret) },
    where: { id: userId },
  });
  return { otpAuthUrl, qrCode: await buildQrDataUrl(otpAuthUrl), secret };
};

/** Confirm enrollment with a code; enable 2FA and return one-time recovery codes. */
export const activateTwoFactor = async (
  userId: string,
  code: string,
  ctx: RequestContext,
): Promise<{ recoveryCodes: string[] }> => {
  const user = await prisma.user.findUnique({
    select: { role: true, totpSecret: true, twoFactorEnabled: true },
    where: { id: userId },
  });
  if (!user?.totpSecret) {
    throw new BadRequestError('Start two-factor setup first');
  }
  if (user.twoFactorEnabled) throw new ConflictError('Two-factor already enabled');
  if (!verifyTotp(code.trim(), decryptSecret(user.totpSecret))) {
    throw new UnauthorizedError('Invalid authentication code');
  }

  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    generateReceiptCode(2, 5),
  );
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      data: { twoFactorEnabled: true },
      where: { id: userId },
    });
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
    await tx.twoFactorRecoveryCode.createMany({
      data: recoveryCodes.map((c) => ({ codeHash: sha256(c), userId })),
    });
  });
  await appendAudit(prisma, {
    action: 'auth.2fa_enabled',
    actorId: userId,
    actorRole: user.role,
    entity: 'User',
    entityId: userId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  return { recoveryCodes };
};

export const disableTwoFactor = async (
  userId: string,
  password: string,
  ctx: RequestContext,
): Promise<void> => {
  const user = await prisma.user.findUnique({
    select: { password: true, role: true },
    where: { id: userId },
  });
  if (!user?.password) throw new NotFoundError('User not found');
  if (!(await verifyPassword(password, user.password))) {
    throw new UnauthorizedError('Password is incorrect');
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      data: { totpSecret: null, twoFactorEnabled: false },
      where: { id: userId },
    });
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
  });
  await appendAudit(prisma, {
    action: 'auth.2fa_disabled',
    actorId: userId,
    actorRole: user.role,
    entity: 'User',
    entityId: userId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
};

export const getProfile = (userId: string) =>
  prisma.user.findUnique({ select: STAFF_SELECT, where: { id: userId } });
