import { beforeEach, describe, expect, it } from 'vitest';

import { Role, Status } from '../../generated/prisma/client.js';
import {
  api,
  bodyOf,
  createUser,
  loginCookie,
  prisma,
  resetDb,
  toCookieHeader,
} from '../helpers.js';

describe('user administration', () => {
  beforeEach(resetDb);

  it('lists users with role/status/search filters (admin+)', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'sa@test.com' });
    await createUser(Role.AGENT, { email: 'agent@test.com' });
    await createUser(Role.ACCREDITOR, { email: 'desk@test.com' });
    const cookie = await loginCookie('sa@test.com');

    const all = await api().get('/api/v1/users').set('Cookie', cookie);
    expect(all.status).toBe(200);
    expect(bodyOf<{ data: unknown[]; meta: { total: number } }>(all).meta.total).toBe(3);

    const accreditors = await api()
      .get('/api/v1/users?role=ACCREDITOR')
      .set('Cookie', cookie);
    const accBody = bodyOf<{ data: { email: string }[] }>(accreditors);
    expect(accBody.data).toHaveLength(1);
    expect(accBody.data[0].email).toBe('desk@test.com');

    const searched = await api()
      .get('/api/v1/users?search=agent@')
      .set('Cookie', cookie);
    expect(bodyOf<{ data: unknown[] }>(searched).data).toHaveLength(1);
  });

  it('rejects list/get for non-admin roles', async () => {
    await createUser(Role.AGENT, { email: 'a1@test.com' });
    const cookie = await loginCookie('a1@test.com');
    expect((await api().get('/api/v1/users').set('Cookie', cookie)).status).toBe(403);
  });

  it('admin updates names; suspension revokes the target sessions', async () => {
    await createUser(Role.ADMIN, { email: 'boss@test.com' });
    const target = await createUser(Role.AGENT, { email: 'worker@test.com' });
    const bossCookie = await loginCookie('boss@test.com');
    const workerLogin = await api()
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'worker@test.com', password: 'Password123!' });
    const workerCookie = toCookieHeader(workerLogin.headers['set-cookie']);

    const res = await api()
      .patch(`/api/v1/users/${target.id}`)
      .set('Cookie', bossCookie)
      .send({ firstName: 'Renamed', status: Status.SUSPENDED });
    expect(res.status).toBe(200);
    expect(bodyOf<{ data: { firstName: string; status: string } }>(res).data.status).toBe(
      'SUSPENDED',
    );

    // The suspended worker's session is gone.
    expect(
      (await api().post('/api/v1/auth/refresh').set('Cookie', workerCookie)).status,
    ).toBe(401);
    // And they can no longer log in.
    const relogin = await api()
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'worker@test.com', password: 'Password123!' });
    expect(relogin.status).toBe(403);
  });

  it('an admin cannot edit a super-admin account, their own, or change roles', async () => {
    const sa = await createUser(Role.SUPER_ADMIN, { email: 'root@test.com' });
    const admin = await createUser(Role.ADMIN, { email: 'admin@test.com' });
    const cookie = await loginCookie('admin@test.com');

    expect(
      (
        await api()
          .patch(`/api/v1/users/${sa.id}`)
          .set('Cookie', cookie)
          .send({ firstName: 'Nope' })
      ).status,
    ).toBe(403);
    expect(
      (
        await api()
          .patch(`/api/v1/users/${admin.id}`)
          .set('Cookie', cookie)
          .send({ firstName: 'Me' })
      ).status,
    ).toBe(400);
    expect(
      (
        await api()
          .patch(`/api/v1/users/${sa.id}/role`)
          .set('Cookie', cookie)
          .send({ role: 'AGENT' })
      ).status,
    ).toBe(403);
  });

  it('super-admin changes a role, which revokes the target sessions', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'root2@test.com' });
    const target = await createUser(Role.ADMIN, { email: 'promote@test.com' });
    const cookie = await loginCookie('root2@test.com');
    const targetLogin = await api()
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'promote@test.com', password: 'Password123!' });
    const targetCookie = toCookieHeader(targetLogin.headers['set-cookie']);

    const res = await api()
      .patch(`/api/v1/users/${target.id}/role`)
      .set('Cookie', cookie)
      .send({ role: 'ACCREDITOR' });
    expect(res.status).toBe(200);
    expect(bodyOf<{ data: { role: string } }>(res).data.role).toBe('ACCREDITOR');
    expect(
      (await api().post('/api/v1/auth/refresh').set('Cookie', targetCookie)).status,
    ).toBe(401);

    // Module-owned accounts (agents/candidates) never pass the role changer.
    const agent = await createUser(Role.AGENT, { email: 'owned@test.com' });
    expect(
      (
        await api()
          .patch(`/api/v1/users/${agent.id}/role`)
          .set('Cookie', cookie)
          .send({ role: 'ADMIN' })
      ).status,
    ).toBe(400);
  });

  it('super-admin cannot change their own role or delete themselves', async () => {
    const sa = await createUser(Role.SUPER_ADMIN, { email: 'self@test.com' });
    const cookie = await loginCookie('self@test.com');
    expect(
      (
        await api()
          .patch(`/api/v1/users/${sa.id}/role`)
          .set('Cookie', cookie)
          .send({ role: 'ADMIN' })
      ).status,
    ).toBe(400);
    expect(
      (await api().delete(`/api/v1/users/${sa.id}`).set('Cookie', cookie)).status,
    ).toBe(400);
  });

  it('super-admin soft-deletes an account (admin cannot)', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'root3@test.com' });
    await createUser(Role.ADMIN, { email: 'admin3@test.com' });
    const target = await createUser(Role.AGENT, { email: 'bye@test.com' });

    const adminCookie = await loginCookie('admin3@test.com');
    expect(
      (await api().delete(`/api/v1/users/${target.id}`).set('Cookie', adminCookie)).status,
    ).toBe(403);

    const saCookie = await loginCookie('root3@test.com');
    expect(
      (await api().delete(`/api/v1/users/${target.id}`).set('Cookie', saCookie)).status,
    ).toBe(200);

    // Soft-deleted: hidden from scoped reads, still present via findUnique.
    expect(await prisma.user.findFirst({ where: { id: target.id } })).toBeNull();
    expect(
      (await prisma.user.findUnique({ where: { id: target.id } }))?.deletedAt,
    ).toBeInstanceOf(Date);
  });
});

describe('contact-change privilege boundaries', () => {
  beforeEach(resetDb);

  it('admins can stage contact changes only on strictly lower tiers', async () => {
    await createUser(Role.ADMIN, { email: 'admin-a@test.com' });
    const peerAdmin = await createUser(Role.ADMIN, { email: 'admin-b@test.com' });
    const superAdmin = await createUser(Role.SUPER_ADMIN, { email: 'root@test.com' });
    const agent = await createUser(Role.AGENT, { email: 'field@test.com' });
    const cookie = await loginCookie('admin-a@test.com');

    // Peer admin and super-admin targets are refused - a contact change is a
    // takeover primitive (email -> password reset).
    for (const target of [peerAdmin, superAdmin]) {
      const res = await api()
        .post(`/api/v1/users/${target.id}/contact/request`)
        .set('Cookie', cookie)
        .send({ email: 'attacker@evil.com' });
      expect(res.status).toBe(403);
    }

    // A strictly lower tier (agent) is allowed and stages the pending email.
    const ok = await api()
      .post(`/api/v1/users/${agent.id}/contact/request`)
      .set('Cookie', cookie)
      .send({ email: 'new-agent-mail@test.com' });
    expect(ok.status).toBe(200);
    const staged = await prisma.user.findUnique({ where: { id: agent.id } });
    expect(staged?.pendingEmail).toBe('new-agent-mail@test.com');
  });
});
