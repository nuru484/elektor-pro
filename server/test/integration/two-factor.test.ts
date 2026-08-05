import { authenticator } from 'otplib';
// Email-OTP 2FA enrollment + login, recovery codes, and OTP hygiene
// (throttle, attempts, expiry) - service-level with capturing fakes.
import { beforeEach, describe, expect, it } from 'vitest';

import { OtpPurpose, Role, Status } from '../../generated/prisma/client.js';
import { MAX_FAILED_LOGIN_ATTEMPTS } from '../../src/config/constants.js';
import { makeAuthService } from '../../src/services/auth/auth.service.js';
import { makeOtpService } from '../../src/services/auth/otp.service.js';
import { codeFrom, createUser, makeTestDeps, prisma, resetDb } from '../helpers.js';

describe('email two-factor authentication', () => {
  beforeEach(resetDb);

  const enroll = async (email: string) => {
    const user = await createUser(Role.ADMIN, { email });
    const t = makeTestDeps();
    const auth = makeAuthService(t.deps);
    await auth.requestEmailTwoFactor(user.id);
    const { recoveryCodes } = await auth.activateEmailTwoFactor(
      user.id,
      codeFrom(t.sentMail.at(-1)?.text),
      {},
    );
    return { auth, recoveryCodes, t, user };
  };

  it('enrolls via emailed code and returns recovery codes', async () => {
    const { recoveryCodes, t } = await enroll('e2fa@test.com');
    expect(recoveryCodes).toHaveLength(10);
    expect(t.sentMail[0].subject).toMatch(/confirm email two-factor/i);
    // Enabling sent a security notice too.
    expect(t.sentMail.some((m) => /two-factor authentication enabled/i.test(m.subject))).toBe(
      true,
    );
  });

  it('login then requires the emailed code and accepts it', async () => {
    const { auth, t } = await enroll('login2fa@test.com');

    const result = await auth.authenticateStaff('login2fa@test.com', 'Password123!', {});
    expect(result.status).toBe('two_factor_required');
    if (result.status !== 'two_factor_required') return;
    expect(result.method).toBe('EMAIL');

    const loginCode = codeFrom(t.sentMail.at(-1)?.text);
    const verified = await auth.verifyStaffTwoFactor(result.userId, loginCode, {});
    expect(verified.userId).toBe(result.userId);
  });

  it('rejects a wrong 2FA code but accepts a recovery code (once)', async () => {
    const { auth, recoveryCodes, t } = await enroll('rec@test.com');
    t.advanceClock(61_000); // past the OTP resend throttle
    const result = await auth.authenticateStaff('rec@test.com', 'Password123!', {});
    if (result.status !== 'two_factor_required') throw new Error('expected 2FA');

    await expect(auth.verifyStaffTwoFactor(result.userId, '999999x', {})).rejects.toMatchObject(
      { status: 401 },
    );

    const viaRecovery = await auth.verifyStaffTwoFactor(result.userId, recoveryCodes[0], {});
    expect(viaRecovery.userId).toBe(result.userId);

    // Recovery codes are single-use.
    t.advanceClock(61_000);
    const again = await auth.authenticateStaff('rec@test.com', 'Password123!', {});
    if (again.status !== 'two_factor_required') throw new Error('expected 2FA');
    t.sentMail.length = 0;
    await expect(
      auth.verifyStaffTwoFactor(again.userId, recoveryCodes[0], {}),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('cannot enable email 2FA without an email on the account', async () => {
    const t = makeTestDeps();
    const user = await t.deps.prisma.user.create({
      data: { firstName: 'No', lastName: 'Email', role: Role.ADMIN },
      select: { id: true },
    });
    const auth = makeAuthService(t.deps);
    await expect(auth.requestEmailTwoFactor(user.id)).rejects.toMatchObject({ status: 400 });
  });
});

describe('otp service hygiene', () => {
  beforeEach(resetDb);

  it('throttles resends inside the window, allows after it', async () => {
    const user = await createUser(Role.ADMIN, { email: 'otp1@test.com' });
    const t = makeTestDeps();
    const otp = makeOtpService(t.deps);

    await otp.issue(user.id, OtpPurpose.STAFF_LOGIN);
    await expect(otp.issue(user.id, OtpPurpose.STAFF_LOGIN)).rejects.toMatchObject({
      status: 429,
    });

    t.advanceClock(61_000);
    await expect(otp.issue(user.id, OtpPurpose.STAFF_LOGIN)).resolves.toBeDefined();
  });

  it('only the LATEST code verifies (older ones are invalidated)', async () => {
    const user = await createUser(Role.ADMIN, { email: 'otp2@test.com' });
    const t = makeTestDeps();
    const otp = makeOtpService(t.deps);

    const first = await otp.issue(user.id, OtpPurpose.STAFF_LOGIN);
    t.advanceClock(61_000);
    const second = await otp.issue(user.id, OtpPurpose.STAFF_LOGIN);

    if (first.code !== second.code) {
      await expect(
        otp.verify(user.id, OtpPurpose.STAFF_LOGIN, first.code),
      ).rejects.toMatchObject({ status: 401 });
    }
    await expect(
      otp.verify(user.id, OtpPurpose.STAFF_LOGIN, second.code),
    ).resolves.toBeUndefined();
  });

  it('expires codes after the TTL', async () => {
    const user = await createUser(Role.ADMIN, { email: 'otp3@test.com' });
    const t = makeTestDeps();
    const otp = makeOtpService(t.deps);

    const issued = await otp.issue(user.id, OtpPurpose.STAFF_LOGIN);
    t.advanceClock(11 * 60 * 1000); // TTL is 10 minutes
    await expect(
      otp.verify(user.id, OtpPurpose.STAFF_LOGIN, issued.code),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('locks out after 5 wrong attempts', async () => {
    const user = await createUser(Role.ADMIN, { email: 'otp4@test.com' });
    const t = makeTestDeps();
    const otp = makeOtpService(t.deps);

    const issued = await otp.issue(user.id, OtpPurpose.STAFF_LOGIN);
    for (let i = 0; i < 5; i += 1) {
      await expect(
        otp.verify(user.id, OtpPurpose.STAFF_LOGIN, '000000'),
      ).rejects.toMatchObject({ status: 401 });
    }
    // Even the right code is refused now.
    await expect(
      otp.verify(user.id, OtpPurpose.STAFF_LOGIN, issued.code),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('codes are single-use', async () => {
    const user = await createUser(Role.ADMIN, { email: 'otp5@test.com' });
    const t = makeTestDeps();
    const otp = makeOtpService(t.deps);

    const issued = await otp.issue(user.id, OtpPurpose.STAFF_LOGIN);
    await otp.verify(user.id, OtpPurpose.STAFF_LOGIN, issued.code);
    await expect(
      otp.verify(user.id, OtpPurpose.STAFF_LOGIN, issued.code),
    ).rejects.toMatchObject({ status: 401 });
  });
});

// ---------------------------------------------------------------------------
// Hardening regressions: the second factor must be as brute-force resistant as
// the first, and a code must be usable exactly once.
// ---------------------------------------------------------------------------
describe('two-factor hardening', () => {
  beforeEach(resetDb);

  it('locks the account after repeated wrong 2FA codes', async () => {
    // The original bug: failed second factors incremented nothing, so a
    // challenge token was an unlimited guessing oracle for its whole 5-minute
    // life. Password failures locked the account; 2FA failures did not.
    const user = await createUser(Role.ADMIN, { email: 'lock2fa@test.com' });
    const t = makeTestDeps();
    const auth = makeAuthService(t.deps);
    await auth.requestEmailTwoFactor(user.id);
    await auth.activateEmailTwoFactor(user.id, codeFrom(t.sentMail.at(-1)?.text), {});

    t.advanceClock(61_000);
    const result = await auth.authenticateStaff('lock2fa@test.com', 'Password123!', {});
    if (result.status !== 'two_factor_required') throw new Error('expected 2FA');

    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      await expect(
        auth.verifyStaffTwoFactor(result.userId, '000000', {}),
      ).rejects.toMatchObject({ status: 401 });
    }

    const locked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(locked.status).toBe(Status.LOCKED);
    expect(locked.lockedAt).not.toBeNull();

    // And the password path is closed too, not just this challenge.
    await expect(
      auth.authenticateStaff('lock2fa@test.com', 'Password123!', {}),
    ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
  });

  it('refuses a TOTP code that has already been used', async () => {
    // The original bug: verification only asked "is this code valid now", and
    // a code stays valid across its +/-1-step drift window - so an observed
    // code could be replayed for about 90 seconds.
    const user = await createUser(Role.ADMIN, { email: 'totp@test.com' });
    const t = makeTestDeps();
    const auth = makeAuthService(t.deps);

    const { secret } = await auth.setupTwoFactor(user.id);
    await auth.activateTwoFactor(user.id, authenticator.generate(secret), {});

    const result = await auth.authenticateStaff('totp@test.com', 'Password123!', {});
    if (result.status !== 'two_factor_required') throw new Error('expected 2FA');
    expect(result.method).toBe('TOTP');

    const code = authenticator.generate(secret);
    const first = await auth.verifyStaffTwoFactor(result.userId, code, {});
    expect(first.userId).toBe(user.id);

    // Same code, still inside its window: must not sign in a second time.
    await expect(
      auth.verifyStaffTwoFactor(result.userId, code, {}),
    ).rejects.toMatchObject({ status: 401 });
  });
});
