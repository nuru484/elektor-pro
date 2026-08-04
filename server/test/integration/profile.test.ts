// Service-level tests for profile self-service, with capturing mail/sms/
// cloudinary fakes so OTP codes can be read from the captured messages, plus
// HTTP-level checks for the route wiring.
import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { makeProfileService } from '../../src/services/auth/profile.service.js';
import {
  api,
  bodyOf,
  codeFrom,
  createUser,
  loginCookie,
  makeTestDeps,
  prisma,
  resetDb,
} from '../helpers.js';

describe('profile self-service', () => {
  beforeEach(resetDb);

  it('updates names over HTTP', async () => {
    await createUser(Role.AGENT, { email: 'agent@test.com' });
    const cookie = await loginCookie('agent@test.com');
    const res = await api()
      .patch('/api/v1/auth/profile')
      .set('Cookie', cookie)
      .send({ firstName: 'Kojo', lastName: 'Asare' });
    expect(res.status).toBe(200);
    const body = bodyOf<{ data: { firstName: string; lastName: string } }>(res);
    expect(body.data.firstName).toBe('Kojo');
    expect(body.data.lastName).toBe('Asare');
  });

  it('rejects an empty profile patch', async () => {
    await createUser(Role.AGENT, { email: 'agent2@test.com' });
    const cookie = await loginCookie('agent2@test.com');
    const res = await api().patch('/api/v1/auth/profile').set('Cookie', cookie).send({});
    expect(res.status).toBe(400);
  });

  it('changes email only after the code sent to the NEW address verifies', async () => {
    const user = await createUser(Role.ADMIN, { email: 'old@test.com' });
    const t = makeTestDeps();
    const profile = makeProfileService(t.deps);

    await profile.requestEmailChange(user.id, 'New@Test.com');
    // Code went to the new (normalized) address.
    expect(t.sentMail[0].email).toBe('new@test.com');
    // Nothing changed yet.
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.email).toBe(
      'old@test.com',
    );

    const updated = await profile.confirmEmailChange(
      user.id,
      codeFrom(t.sentMail[0].text),
      {},
    );
    expect(updated.email).toBe('new@test.com');
    // The OLD address got the security warning.
    expect(t.sentMail.some((m) => m.email === 'old@test.com')).toBe(true);
  });

  it('rejects an email already in use', async () => {
    const user = await createUser(Role.ADMIN, { email: 'me@test.com' });
    await createUser(Role.ADMIN, { email: 'taken@test.com' });
    const t = makeTestDeps();
    const profile = makeProfileService(t.deps);
    await expect(profile.requestEmailChange(user.id, 'taken@test.com')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('rejects a wrong email-change code', async () => {
    const user = await createUser(Role.ADMIN, { email: 'x@test.com' });
    const t = makeTestDeps();
    const profile = makeProfileService(t.deps);
    await profile.requestEmailChange(user.id, 'y@test.com');
    await expect(profile.confirmEmailChange(user.id, '000000', {})).rejects.toMatchObject({
      status: 401,
    });
  });

  it('changes phone via SMS code to the new number', async () => {
    const user = await createUser(Role.CANDIDATE, { email: 'cand@test.com' });
    const t = makeTestDeps();
    const profile = makeProfileService(t.deps);

    await profile.requestPhoneChange(user.id, '0244123456');
    expect(t.sentSms[0].to).toBe('+233244123456');

    const updated = await profile.confirmPhoneChange(
      user.id,
      codeFrom(t.sentSms[0].message),
      {},
    );
    expect(updated.phone).toBe('+233244123456');
  });

  it('uploads a profile photo and cleans up the previous one', async () => {
    const user = await createUser(Role.ADMIN, { email: 'pic@test.com' });
    const t = makeTestDeps();
    const profile = makeProfileService(t.deps);

    const first = await profile.updateProfilePicture(
      user.id,
      { buffer: Buffer.from('img1') },
      {},
    );
    expect(first.profilePicture).toContain('cloudinary');

    await profile.updateProfilePicture(user.id, { buffer: Buffer.from('img2') }, {});
    // The first upload was deleted once replaced.
    expect(t.deleted).toContain(first.profilePicture);
  });

  it('requires an image file on the picture endpoint', async () => {
    await createUser(Role.ADMIN, { email: 'nopic@test.com' });
    const cookie = await loginCookie('nopic@test.com');
    const res = await api().patch('/api/v1/auth/profile/picture').set('Cookie', cookie);
    expect(res.status).toBe(400);
  });
});
