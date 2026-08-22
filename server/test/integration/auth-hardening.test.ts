// test/integration/auth-hardening.test.ts
//
// Auth hardening: the server-side forced-password-change gate,
// recovery-code regeneration + remaining count, and the auth-hygiene sweep.
import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { sweepExpiredAuthRecords } from '../../src/services/auth/auth-maintenance.service.js';
import { api, bodyOf, createUser, loginCookie, prisma, resetDb } from '../helpers.js';

describe('forced password change gate', () => {
  beforeEach(resetDb);

  it('blocks everything except /auth/me and the change itself until the password is changed', async () => {
    const admin = await createUser(Role.SUPER_ADMIN, { email: 'gate@test.com' });
    await prisma.user.update({
      data: { mustChangePassword: true },
      where: { id: admin.id },
    });
    const cookie = await loginCookie('gate@test.com');

    const blocked = await api().get('/api/v1/elections').set('Cookie', cookie);
    expect(blocked.status).toBe(403);
    expect(bodyOf<{ code?: string }>(blocked).code).toBe('PASSWORD_CHANGE_REQUIRED');

    const me = await api().get('/api/v1/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(
      bodyOf<{ data: { mustChangePassword: boolean } }>(me).data.mustChangePassword,
    ).toBe(true);

    const change = await api()
      .post('/api/v1/auth/password/change')
      .set('Cookie', cookie)
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword123!' });
    expect(change.status).toBe(200);

    // The gate lifts immediately (cache invalidated on change).
    const allowed = await api().get('/api/v1/elections').set('Cookie', cookie);
    expect(allowed.status).toBe(200);
  });
});

describe('recovery code regeneration + count', () => {
  beforeEach(resetDb);

  const twoFactorUser = async () => {
    const user = await createUser(Role.ADMIN, { email: '2fa@test.com' });
    // Session first: with 2FA on, a plain password login would return a
    // challenge instead of cookies.
    const cookie = await loginCookie('2fa@test.com');
    await prisma.user.update({
      data: { twoFactorEnabled: true, twoFactorMethod: 'EMAIL' },
      where: { id: user.id },
    });
    return { cookie, user };
  };

  it('regenerates 10 codes behind a password check and reports the remaining count', async () => {
    const { cookie, user } = await twoFactorUser();

    const wrongPassword = await api()
      .post('/api/v1/auth/2fa/recovery-codes')
      .set('Cookie', cookie)
      .send({ password: 'WrongPassword1!' });
    expect(wrongPassword.status).toBe(401);

    const res = await api()
      .post('/api/v1/auth/2fa/recovery-codes')
      .set('Cookie', cookie)
      .send({ password: 'Password123!' });
    expect(res.status).toBe(200);
    const codes = bodyOf<{ data: { recoveryCodes: string[] } }>(res).data.recoveryCodes;
    expect(codes).toHaveLength(10);

    const me = await api().get('/api/v1/auth/me').set('Cookie', cookie);
    expect(
      bodyOf<{ data: { twoFactorRecoveryCodesRemaining: null | number } }>(me).data
        .twoFactorRecoveryCodesRemaining,
    ).toBe(10);

    // Consuming a code decrements the reported count.
    const one = await prisma.twoFactorRecoveryCode.findFirstOrThrow({
      where: { userId: user.id },
    });
    await prisma.twoFactorRecoveryCode.update({
      data: { usedAt: new Date() },
      where: { id: one.id },
    });
    const meAfter = await api().get('/api/v1/auth/me').set('Cookie', cookie);
    expect(
      bodyOf<{ data: { twoFactorRecoveryCodesRemaining: null | number } }>(meAfter)
        .data.twoFactorRecoveryCodesRemaining,
    ).toBe(9);
  });

  it('refuses regeneration when two-factor is not enabled', async () => {
    await createUser(Role.ADMIN, { email: 'no2fa@test.com' });
    const cookie = await loginCookie('no2fa@test.com');
    const res = await api()
      .post('/api/v1/auth/2fa/recovery-codes')
      .set('Cookie', cookie)
      .send({ password: 'Password123!' });
    expect(res.status).toBe(400);
  });
});

describe('auth-hygiene sweep', () => {
  beforeEach(resetDb);

  it('purges long-expired auth records and keeps live ones', async () => {
    const user = await createUser(Role.ADMIN, { email: 'sweep@test.com' });
    const now = new Date();
    const daysAgo = (days: number) =>
      new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    await prisma.otp.createMany({
      data: [
        // Expired well past the 1-day retention: purged.
        { codeHash: 'a', expiresAt: daysAgo(2), userId: user.id },
        // Still valid: kept.
        { codeHash: 'b', expiresAt: daysAgo(-1), userId: user.id },
      ],
    });
    await prisma.passwordResetToken.createMany({
      data: [
        { expiresAt: daysAgo(-1), tokenHash: 't1', usedAt: daysAgo(3), userId: user.id },
        { expiresAt: daysAgo(-1), tokenHash: 't2', userId: user.id },
      ],
    });
    await prisma.session.createMany({
      data: [
        // Revoked 31 days ago: past the 30-day session retention, purged.
        {
          expiresAt: daysAgo(-1),
          revokedAt: daysAgo(31),
          tokenHash: 's1',
          userId: user.id,
        },
        // Active: kept.
        { expiresAt: daysAgo(-7), tokenHash: 's2', userId: user.id },
        // Recently expired (within retention): kept for forensics.
        { expiresAt: daysAgo(2), tokenHash: 's3', userId: user.id },
      ],
    });

    const result = await sweepExpiredAuthRecords(now);
    expect(result).toEqual({ otps: 1, resetTokens: 1, sessions: 1 });

    expect(await prisma.otp.count()).toBe(1);
    expect(await prisma.passwordResetToken.count()).toBe(1);
    expect(await prisma.session.count({ where: {} })).toBe(2);
  });
});
