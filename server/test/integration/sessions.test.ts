import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { fixedClock } from '../../src/lib/clock.js';
import { makeSessionService } from '../../src/services/auth/session.service.js';
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

  it('refresh rotates the token', async () => {
    await createUser(Role.ADMIN, { email: 'b@test.com' });
    const login = await loginRes('b@test.com');
    const oldRefresh = cookieValue(login.headers['set-cookie'], 'refreshToken');

    const refresh = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${oldRefresh}`);
    expect(refresh.status).toBe(200);
    const newRefresh = cookieValue(refresh.headers['set-cookie'], 'refreshToken');
    expect(newRefresh).not.toBe(oldRefresh);
  });

  /**
   * Regression: two tabs sharing one cookie jar both hit the access-token
   * expiry together and both present the same refresh token. One rotates
   * first; the other arrives a moment later holding what is now the previous
   * token. That used to read as theft and revoke the session, so a user
   * browsing normally in two tabs was suddenly signed out of both.
   */
  it('accepts the previous token during the rotation grace window', async () => {
    await createUser(Role.ADMIN, { email: 'b2@test.com' });
    const login = await loginRes('b2@test.com');
    const oldRefresh = cookieValue(login.headers['set-cookie'], 'refreshToken');

    const first = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${oldRefresh}`);
    expect(first.status).toBe(200);
    const newRefresh = cookieValue(first.headers['set-cookie'], 'refreshToken');

    // The tab that lost the race, still carrying the pre-rotation token.
    const raced = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${oldRefresh}`);
    expect(raced.status).toBe(200);

    // Neither tab has been signed out: the token from the first rotation is
    // now the previous one, and still works inside the same window.
    const stillAlive = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${newRefresh}`);
    expect(stillAlive.status).toBe(200);
  });

  /**
   * Regression for the logout that survived the first grace-window fix.
   *
   * Both tabs refreshed and BOTH were handed a new refresh token. The browser
   * keeps whichever response landed last, so half the time it ended up holding
   * the loser's token while the row remembered the winner's. Nothing failed at
   * the time - the break came at the NEXT refresh half an hour later, when
   * that token was neither current nor inside the grace window and was read as
   * theft. The loser must therefore get no refresh cookie at all.
   */
  it('does not issue a second refresh token to the loser of a rotation race', async () => {
    await createUser(Role.ADMIN, { email: 'b4@test.com' });
    const login = await loginRes('b4@test.com');
    const original = cookieValue(login.headers['set-cookie'], 'refreshToken');

    const winner = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${original}`);
    expect(winner.status).toBe(200);
    const winnerToken = cookieValue(winner.headers['set-cookie'], 'refreshToken');

    const loser = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${original}`);
    expect(loser.status).toBe(200);
    // A fresh access token so the racing request can proceed...
    expect(cookieValue(loser.headers['set-cookie'], 'accessToken')).not.toBe('');
    // ...but no competing refresh token to overwrite the winner's.
    expect(cookieValue(loser.headers['set-cookie'], 'refreshToken')).toBe('');

    // The winner's token is still the live one long after the grace window,
    // which is where the old behaviour blew up.
    const later = makeSessionService({
      clock: fixedClock(Date.now() + 60_000),
      prisma,
    });
    await expect(later.rotateSession(winnerToken)).resolves.toMatchObject({
      rotated: true,
    });
  });

  /**
   * The grace window is the only thing that softens reuse detection, so it has
   * to be bounded: a token replayed after it must still revoke the session.
   * Driven through the service with a clock advanced past the window, since
   * the HTTP app runs on the real one.
   */
  it('revokes the session when the previous token is replayed after the grace window', async () => {
    const user = await createUser(Role.ADMIN, { email: 'b3@test.com' });
    const login = await loginRes('b3@test.com');
    const oldRefresh = cookieValue(login.headers['set-cookie'], 'refreshToken');

    await api().post('/api/v1/auth/refresh').set('Cookie', `refreshToken=${oldRefresh}`).expect(200);

    // A minute later, the pre-rotation token turns up again: that is replay,
    // not a race.
    const later = makeSessionService({
      clock: fixedClock(Date.now() + 60_000),
      prisma,
    });
    await expect(later.rotateSession(oldRefresh)).rejects.toThrow(/invalidated/i);

    const sessions = await prisma.session.findMany({
      select: { revokedAt: true },
      where: { userId: user.id },
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].revokedAt).not.toBeNull();
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
