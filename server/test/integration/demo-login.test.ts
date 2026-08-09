// test/integration/demo-login.test.ts
//
// Credential-free demo sign-in. The interesting cases are the refusals: the
// endpoint must stay shut unless a deployment opts in, and it must never
// resolve to an account that is not the advertised role.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { api, createUser, prisma, resetDb } from '../helpers.js';

// ENV is read at module load, so the flag is patched on the loaded object.
const withDemoEnabled = async (enabled: boolean): Promise<void> => {
  const ENV = (await import('../../src/config/env.js')).default;
  vi.spyOn(ENV, 'DEMO_LOGIN_ENABLED', 'get').mockReturnValue(enabled);
};

describe('demo login', () => {
  beforeEach(resetDb);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is refused when the deployment has not enabled it', async () => {
    await withDemoEnabled(false);
    const res = await api().post('/api/v1/auth/demo-login').send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('rejects a role that is not on the demo list', async () => {
    await withDemoEnabled(true);
    const res = await api()
      .post('/api/v1/auth/demo-login')
      .send({ role: 'NOT_A_ROLE' });
    expect(res.status).toBe(400);
  });

  it('reports a missing fixture rather than signing anyone in', async () => {
    await withDemoEnabled(true);
    const res = await api().post('/api/v1/auth/demo-login').send({ role: 'ADMIN' });
    expect(res.status).toBe(404);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('signs in as the seeded account and sets session cookies', async () => {
    await withDemoEnabled(true);
    const ENV = (await import('../../src/config/env.js')).default;
    await createUser(Role.ADMIN, { email: ENV.DEMO_ADMIN_EMAIL });

    const res = await api().post('/api/v1/auth/demo-login').send({ role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('refuses when the seeded account no longer holds the advertised role', async () => {
    await withDemoEnabled(true);
    const ENV = (await import('../../src/config/env.js')).default;
    // Same email, wrong role: a demoted fixture must not open the admin console.
    const user = await createUser(Role.ADMIN, { email: ENV.DEMO_ADMIN_EMAIL });
    await prisma.user.update({
      data: { role: Role.CANDIDATE },
      where: { id: user.id },
    });

    const res = await api().post('/api/v1/auth/demo-login').send({ role: 'ADMIN' });
    expect(res.status).toBe(404);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
