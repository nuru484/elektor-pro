import { beforeEach, describe, expect, it } from 'vitest';

import { api, createUser, prisma, resetDb } from '../helpers.js';
import { MAX_FAILED_LOGIN_ATTEMPTS } from '../../src/config/constants.js';
import { Role } from '../../generated/prisma/client.js';

describe('staff authentication', () => {
  beforeEach(resetDb);

  it('logs in with valid credentials and sets cookies', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'sa@test.com' });
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'sa@test.com', password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('SUPER_ADMIN');
    expect(res.headers['set-cookie'].join()).toContain('accessToken');
  });

  it('rejects an invalid password', async () => {
    await createUser(Role.ADMIN, { email: 'a@test.com' });
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'a@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('locks the account after too many failed attempts', async () => {
    await createUser(Role.ADMIN, { email: 'lock@test.com' });
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i += 1) {
      await api()
        .post('/api/v1/auth/login')
        .send({ emailOrPhone: 'lock@test.com', password: 'wrongpass' });
    }
    const user = await prisma.user.findUnique({ where: { email: 'lock@test.com' } });
    expect(user?.status).toBe('LOCKED');

    // Even the correct password is now refused.
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'lock@test.com', password: 'Password123!' });
    expect(res.status).toBe(403);
  });

  it('does not allow a voter to use the staff password login', async () => {
    await createUser(Role.VOTER, { email: 'voter@test.com' });
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'voter@test.com', password: 'Password123!' });
    expect(res.status).toBe(401);
  });
});
