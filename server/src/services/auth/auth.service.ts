// src/services/auth/auth.service.ts
// Staff/candidate/agent/accreditor authentication: password login with
// lockout, TOTP or email-OTP 2FA, super-admin unlock, password change/reset.
// Factory-built (makeAuthService) so unit tests can inject a frozen clock and
// fake sms/mail channels.
import {
  OtpPurpose,
  Role,
  Status,
  TwoFactorMethod,
} from '../../../generated/prisma/client.js';
import { MAX_FAILED_LOGIN_ATTEMPTS } from '../../config/constants.js';
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
import { getEffectiveCapabilities } from '../authorization/capability.service.js';
import { type AppDeps, defaultDeps } from '../deps.js';
import { makeSecurityNoticeService } from '../notifications/security-notice.service.js';
import { makeOtpService } from './otp.service.js';
import { makeSessionService } from './session.service.js';
import {
  buildOtpAuthUrl,
  buildQrDataUrl,
  generateTotpSecret,
  verifyTotp,
} from './totp.service.js';

const PASSWORD_LOGIN_ROLES = new Set<Role>([
  Role.ACCREDITOR,
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
  twoFactorMethod: true,
  updatedAt: true,
} as const;

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

const isPhone = (value: string): boolean => /^[\d\s+\-()]+$/.test(value);

export const makeAuthService = (
  d: Pick<AppDeps, 'clock' | 'config' | 'logger' | 'mail' | 'prisma' | 'sms'>,
) => {
  const { clock, config, prisma } = d;
  const otp = makeOtpService(d);
  const sessions = makeSessionService(d);
  const notices = makeSecurityNoticeService(d);

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
        OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
      },
    });
  };

  /** The 2FA method in effect for a user (legacy rows default to TOTP). */
  const effectiveMethod = (user: {
    totpSecret: null | string;
    twoFactorMethod: null | TwoFactorMethod;
  }): TwoFactorMethod =>
    user.twoFactorMethod ?? (user.totpSecret ? TwoFactorMethod.TOTP : TwoFactorMethod.EMAIL);

  /**
   * Verify password credentials. Returns an authenticated user, or signals
   * that a 2FA challenge is required (already dispatched for the EMAIL
   * method). Increments the failed-attempt counter and locks the account on
   * too many failures.
   */
  const authenticateStaff = async (
    emailOrPhone: string,
    password: string,
    ctx: RequestContext,
  ): Promise<
    | { method: TwoFactorMethod; status: 'two_factor_required'; userId: string }
    | { role: Role; status: 'authenticated'; userId: string }
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
                lockedAt: clock.now(),
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
      const method = effectiveMethod(user);
      if (method === TwoFactorMethod.EMAIL) {
        if (!user.email) {
          throw new BadRequestError('No email on record for email verification codes');
        }
        const issued = await otp.issue(user.id, OtpPurpose.STAFF_LOGIN);
        await d.mail.send({
          email: user.email,
          subject: 'Your Elektor Pro sign-in code',
          text: `Your sign-in code is ${issued.code}. It expires in ${issued.ttlMinutes} minutes.`,
        });
      }
      return { method, status: 'two_factor_required', userId: user.id };
    }

    await prisma.user.update({
      data: { failedLoginAttempts: 0, lastLoginAt: clock.now() },
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

  /** Try a single-use recovery code; consumes it on success. */
  const tryRecoveryCode = async (userId: string, code: string): Promise<boolean> => {
    const codeHash = sha256(code.trim().toUpperCase());
    const candidates = await prisma.twoFactorRecoveryCode.findMany({
      select: { codeHash: true, id: true },
      where: { usedAt: null, userId },
    });
    const match = candidates.find((c) => safeEqual(c.codeHash, codeHash));
    if (!match) return false;
    await prisma.twoFactorRecoveryCode.update({
      data: { usedAt: clock.now() },
      where: { id: match.id },
    });
    return true;
  };

  /** Complete login by verifying a TOTP/email code or a recovery code. */
  const verifyStaffTwoFactor = async (
    userId: string,
    code: string,
    ctx: RequestContext,
  ): Promise<{ role: Role; userId: string }> => {
    const user = await prisma.user.findUnique({
      select: {
        email: true,
        id: true,
        role: true,
        status: true,
        totpSecret: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
      },
      where: { id: userId },
    });
    if (!user?.twoFactorEnabled) {
      throw new UnauthorizedError('Two-factor authentication not configured');
    }
    if (user.status !== Status.ACTIVE) {
      throw new ForbiddenError('Account is not active');
    }

    let verified = false;
    const method = effectiveMethod(user);

    if (method === TwoFactorMethod.TOTP && user.totpSecret) {
      verified = verifyTotp(code.trim(), decryptSecret(user.totpSecret));
    } else if (method === TwoFactorMethod.EMAIL) {
      try {
        await otp.verify(userId, OtpPurpose.STAFF_LOGIN, code);
        verified = true;
      } catch {
        verified = false;
      }
    }

    if (!verified) {
      verified = await tryRecoveryCode(userId, code);
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
      data: { failedLoginAttempts: 0, lastLoginAt: clock.now() },
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
  const unlockAccount = async (
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

  /** Change the password; signs every OTHER device out and notifies. */
  const changePassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId: string | undefined,
    ctx: RequestContext,
  ): Promise<void> => {
    const user = await prisma.user.findUnique({
      select: { email: true, firstName: true, password: true, role: true },
      where: { id: userId },
    });
    if (!user?.password) throw new NotFoundError('User not found');
    if (!(await verifyPassword(currentPassword, user.password))) {
      throw new UnauthorizedError('Current password is incorrect');
    }
    await prisma.user.update({
      data: { password: await hashPassword(newPassword), passwordChangedAt: clock.now() },
      where: { id: userId },
    });
    if (currentSessionId) {
      await sessions.revokeOtherSessions(userId, currentSessionId);
    } else {
      await sessions.revokeAllSessions(userId);
    }
    await appendAudit(prisma, {
      action: 'auth.password_changed',
      actorId: userId,
      actorRole: user.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    await notices.passwordChanged(user);
  };

  /** Issue a password-reset token (sent by email/SMS). Never reveals existence. */
  const requestPasswordReset = async (emailOrPhone: string): Promise<void> => {
    const user = await findByIdentifier(emailOrPhone);
    if (!user || !PASSWORD_LOGIN_ROLES.has(user.role)) return;

    const token = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        expiresAt: new Date(clock.timestamp() + PASSWORD_RESET_TTL_MS),
        tokenHash: sha256(token),
        userId: user.id,
      },
    });
    const link = `${config.FRONTEND_URL}/reset-password?token=${token}`;
    if (user.email) {
      await d.mail.send({
        email: user.email,
        subject: 'Reset your Elektor Pro password',
        text: `Reset your password using this link (valid for 30 minutes): ${link}`,
      });
    } else if (user.phone) {
      await d.sms.send(user.phone, `Reset your Elektor Pro password: ${link}`);
    }
  };

  /** Complete a reset; kills every session and notifies. */
  const resetPassword = async (
    token: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<void> => {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record || record.usedAt || record.expiresAt < clock.now()) {
      throw new BadRequestError('Invalid or expired reset token');
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        data: {
          failedLoginAttempts: 0,
          lockedAt: null,
          password: await hashPassword(newPassword),
          passwordChangedAt: clock.now(),
          status: Status.ACTIVE,
        },
        where: { id: record.userId },
      });
      await tx.passwordResetToken.update({
        data: { usedAt: clock.now() },
        where: { id: record.id },
      });
    });
    await sessions.revokeAllSessions(record.userId);
    await appendAudit(prisma, {
      action: 'auth.password_reset',
      actorId: record.userId,
      entity: 'User',
      entityId: record.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    const user = await prisma.user.findUnique({
      select: { email: true, firstName: true },
      where: { id: record.userId },
    });
    if (user) await notices.passwordChanged(user);
  };

  /** Generate + persist one-time recovery codes (replacing any existing). */
  const issueRecoveryCodes = async (userId: string): Promise<string[]> => {
    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      generateReceiptCode(2, 5),
    );
    await prisma.$transaction(async (tx) => {
      await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
      await tx.twoFactorRecoveryCode.createMany({
        data: recoveryCodes.map((c) => ({ codeHash: sha256(c), userId })),
      });
    });
    return recoveryCodes;
  };

  /** Begin TOTP enrollment: store a candidate secret, return the QR + URL. */
  const setupTwoFactor = async (
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

  /** Confirm TOTP enrollment with a code; returns one-time recovery codes. */
  const activateTwoFactor = async (
    userId: string,
    code: string,
    ctx: RequestContext,
  ): Promise<{ recoveryCodes: string[] }> => {
    const user = await prisma.user.findUnique({
      select: {
        email: true,
        firstName: true,
        role: true,
        totpSecret: true,
        twoFactorEnabled: true,
      },
      where: { id: userId },
    });
    if (!user?.totpSecret) {
      throw new BadRequestError('Start two-factor setup first');
    }
    if (user.twoFactorEnabled) throw new ConflictError('Two-factor already enabled');
    if (!verifyTotp(code.trim(), decryptSecret(user.totpSecret))) {
      throw new UnauthorizedError('Invalid authentication code');
    }

    const recoveryCodes = await issueRecoveryCodes(userId);
    await prisma.user.update({
      data: { twoFactorEnabled: true, twoFactorMethod: TwoFactorMethod.TOTP },
      where: { id: userId },
    });
    await appendAudit(prisma, {
      action: 'auth.2fa_enabled',
      actorId: userId,
      actorRole: user.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      metadata: { method: TwoFactorMethod.TOTP },
      userAgent: ctx.userAgent,
    });
    await notices.twoFactorEnabled(user, 'authenticator app');
    return { recoveryCodes };
  };

  /** Begin email-2FA enrollment: send a confirmation code to the email. */
  const requestEmailTwoFactor = async (userId: string): Promise<{ emailMasked: string }> => {
    const user = await prisma.user.findUnique({
      select: { email: true, twoFactorEnabled: true },
      where: { id: userId },
    });
    if (!user) throw new NotFoundError('User not found');
    if (user.twoFactorEnabled) throw new ConflictError('Two-factor is already enabled');
    if (!user.email) {
      throw new BadRequestError('Add an email address to your profile first');
    }
    const issued = await otp.issue(userId, OtpPurpose.TWO_FACTOR_EMAIL_ENABLE);
    await d.mail.send({
      email: user.email,
      subject: 'Confirm email two-factor authentication',
      text: `Your confirmation code is ${issued.code}. It expires in ${issued.ttlMinutes} minutes.`,
    });
    const [name = '', domain = ''] = user.email.split('@');
    return { emailMasked: `${name.slice(0, 2)}***@${domain}` };
  };

  /** Confirm email-2FA enrollment; returns one-time recovery codes. */
  const activateEmailTwoFactor = async (
    userId: string,
    code: string,
    ctx: RequestContext,
  ): Promise<{ recoveryCodes: string[] }> => {
    const user = await prisma.user.findUnique({
      select: { email: true, firstName: true, role: true, twoFactorEnabled: true },
      where: { id: userId },
    });
    if (!user) throw new NotFoundError('User not found');
    if (user.twoFactorEnabled) throw new ConflictError('Two-factor already enabled');
    await otp.verify(userId, OtpPurpose.TWO_FACTOR_EMAIL_ENABLE, code);

    const recoveryCodes = await issueRecoveryCodes(userId);
    await prisma.user.update({
      data: { twoFactorEnabled: true, twoFactorMethod: TwoFactorMethod.EMAIL },
      where: { id: userId },
    });
    await appendAudit(prisma, {
      action: 'auth.2fa_enabled',
      actorId: userId,
      actorRole: user.role,
      entity: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      metadata: { method: TwoFactorMethod.EMAIL },
      userAgent: ctx.userAgent,
    });
    await notices.twoFactorEnabled(user, 'email codes');
    return { recoveryCodes };
  };

  /** Turn 2FA off (password-confirmed); clears secrets + recovery codes. */
  const disableTwoFactor = async (
    userId: string,
    password: string,
    ctx: RequestContext,
  ): Promise<void> => {
    const user = await prisma.user.findUnique({
      select: { email: true, firstName: true, password: true, role: true },
      where: { id: userId },
    });
    if (!user?.password) throw new NotFoundError('User not found');
    if (!(await verifyPassword(password, user.password))) {
      throw new UnauthorizedError('Password is incorrect');
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        data: { totpSecret: null, twoFactorEnabled: false, twoFactorMethod: null },
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
    await notices.twoFactorDisabled(user);
  };

  // Profile + the capabilities the user effectively holds (runtime role
  // matrix + global grants) so the client can gate navigation and actions.
  const getProfile = async (userId: string) => {
    const user = await prisma.user.findUnique({
      select: STAFF_SELECT,
      where: { id: userId },
    });
    if (!user) return null;
    return {
      ...user,
      capabilities: await getEffectiveCapabilities({ id: user.id, role: user.role }),
    };
  };

  return {
    activateEmailTwoFactor,
    activateTwoFactor,
    authenticateStaff,
    changePassword,
    disableTwoFactor,
    getProfile,
    requestEmailTwoFactor,
    requestPasswordReset,
    resetPassword,
    setupTwoFactor,
    unlockAccount,
    verifyStaffTwoFactor,
  };
};

export type AuthService = ReturnType<typeof makeAuthService>;

/** Production wiring used by controllers. */
export const authService = makeAuthService(defaultDeps);

export const {
  activateEmailTwoFactor,
  activateTwoFactor,
  authenticateStaff,
  changePassword,
  disableTwoFactor,
  getProfile,
  requestEmailTwoFactor,
  requestPasswordReset,
  resetPassword,
  setupTwoFactor,
  unlockAccount,
  verifyStaffTwoFactor,
} = authService;
