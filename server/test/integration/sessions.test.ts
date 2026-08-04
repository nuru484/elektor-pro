import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import {
  api,
  bodyOf,
  createUser,
  prisma,
  resetDb,
  toCookieHeader,
} from '../helpers.js';

const loginRes = async (email: string) =>
  api().post('/api/v1/auth/login').send({ emailOrPhone: email, password: 'Password123!' });

/** Extract one named cookie value from a login/refresh response. */
const cookieValue = (setCookie: string | string[] | undefined, name: string): string => {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const cookie of arr.reverse()) {
    const pair = cookie.split(';')[0];
    if (pair.startsWith(`${name}=`) && pair.slice(name.length + 1) !== '') {
      return pair.slice(name.length + 1);
    }
  }
  return '';
};

describe('refresh-token sessions', () => {
  beforeEach(resetDb);

  it('login creates a persisted session listed as current', async () => {
    await createUser(Role.ADMIN, { email: 'a@test.com' });
    const res = await loginRes('a@test.com');
    expect(res.status).toBe(200);
    expect(await prisma.session.count()).toBe(1);

    const list = await api()
      .get('/api/v1/auth/sessions')
      .set('Cookie', toCookieHeader(res.headers['set-cookie']));
    expect(list.status).toBe(200);
    const body = bodyOf<{ data: { current: boolean; id: string }[] }>(list);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].current).toBe(true);
  });

  it('refresh rotates the token; the old refresh token is dead and kills the session on reuse', async () => {
    await createUser(Role.ADMIN, { email: 'b@test.com' });
    const login = await loginRes('b@test.com');
    const oldRefresh = cookieValue(login.headers['set-cookie'], 'refreshToken');

    const refresh = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${oldRefresh}`);
    expect(refresh.status).toBe(200);
    const newRefresh = cookieValue(refresh.headers['set-cookie'], 'refreshToken');
    expect(newRefresh).not.toBe(oldRefresh);

    // Replaying the pre-rotation token = theft signal: 401 AND revoked session.
    const replay = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${oldRefresh}`);
    expect(replay.status).toBe(401);

    // The whole session is now dead - even the newer token fails.
    const afterReuse = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${newRefresh}`);
    expect(afterReuse.status).toBe(401);
  });

  it('logout revokes the session', async () => {
    await createUser(Role.ADMIN, { email: 'c@test.com' });
    const login = await loginRes('c@test.com');
    const cookie = toCookieHeader(login.headers['set-cookie']);

    await api().post('/api/v1/auth/logout').set('Cookie', cookie).expect(200);

    const refresh = await api().post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);
  });

  it('revoking another device signs only that device out', async () => {
    await createUser(Role.ADMIN, { email: 'd@test.com' });
    const first = await loginRes('d@test.com');
    const second = await loginRes('d@test.com');
    const firstCookie = toCookieHeader(first.headers['set-cookie']);
    const secondCookie = toCookieHeader(second.headers['set-cookie']);

    const list = await api().get('/api/v1/auth/sessions').set('Cookie', secondCookie);
    const other = bodyOf<{ data: { current: boolean; id: string }[] }>(list).data.find(
      (s) => !s.current,
    );
    expect(other).toBeDefined();

    await api()
      .delete(`/api/v1/auth/sessions/${other?.id}`)
      .set('Cookie', secondCookie)
      .expect(200);

    // First device's refresh now fails; second still works.
    expect(
      (await api().post('/api/v1/auth/refresh').set('Cookie', firstCookie)).status,
    ).toBe(401);
    expect(
      (await api().post('/api/v1/auth/refresh').set('Cookie', secondCookie)).status,
    ).toBe(200);
  });

  it('revoking other sessions keeps only the current one', async () => {
    await createUser(Role.ADMIN, { email: 'e@test.com' });
    await loginRes('e@test.com');
    await loginRes('e@test.com');
    const third = await loginRes('e@test.com');
    const cookie = toCookieHeader(third.headers['set-cookie']);

    const res = await api().delete('/api/v1/auth/sessions/others').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(bodyOf<{ data: { revoked: number } }>(res).data.revoked).toBe(2);

    const list = await api().get('/api/v1/auth/sessions').set('Cookie', cookie);
    expect(bodyOf<{ data: unknown[] }>(list).data).toHaveLength(1);
  });

  it('a password change signs every other device out but keeps the current one', async () => {
    await createUser(Role.ADMIN, { email: 'f@test.com' });
    const other = await loginRes('f@test.com');
    const current = await loginRes('f@test.com');
    const otherCookie = toCookieHeader(other.headers['set-cookie']);
    const currentCookie = toCookieHeader(current.headers['set-cookie']);

    await api()
      .post('/api/v1/auth/password/change')
      .set('Cookie', currentCookie)
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword123!' })
      .expect(200);

    expect(
      (await api().post('/api/v1/auth/refresh').set('Cookie', otherCookie)).status,
    ).toBe(401);
    expect(
      (await api().post('/api/v1/auth/refresh').set('Cookie', currentCookie)).status,
    ).toBe(200);

    // And the new password is the one that works now.
    expect((await loginRes('f@test.com')).status).toBe(401);
    const relogin = await api()
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'f@test.com', password: 'NewPassword123!' });
    expect(relogin.status).toBe(200);
  });

  it("cannot revoke another user's session", async () => {
    await createUser(Role.ADMIN, { email: 'g@test.com' });
    await createUser(Role.ADMIN, { email: 'h@test.com' });
    const gLogin = await loginRes('g@test.com');
    const hLogin = await loginRes('h@test.com');
    const gCookie = toCookieHeader(gLogin.headers['set-cookie']);
    const hCookie = toCookieHeader(hLogin.headers['set-cookie']);

    const hSessionRes = await api().get('/api/v1/auth/sessions').set('Cookie', hCookie);
    const hSession = bodyOf<{ data: { id: string }[] }>(hSessionRes).data[0];

    const res = await api()
      .delete(`/api/v1/auth/sessions/${hSession.id}`)
      .set('Cookie', gCookie);
    expect(res.status).toBe(404);
  });
});
