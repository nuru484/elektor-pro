import { beforeEach, describe, expect, it } from 'vitest';

import {
  api,
  createElectionFixture,
  createUser,
  loginCookie,
  prisma,
  resetDb,
} from '../helpers.js';
import { Role } from '../../generated/prisma/client.js';

describe('maker-checker governance', () => {
  beforeEach(resetDb);

  it('stages an admin create as pending and applies it on super-admin approval', async () => {
    const { election, portfolio } = await createElectionFixture();
    await createUser(Role.ADMIN, { email: 'admin@test.com' });
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });

    const adminCookie = await loginCookie('admin@test.com');
    const created = await api()
      .post('/api/v1/candidates')
      .set('Cookie', adminCookie)
      .send({ electionId: election.id, name: 'Pending Person', portfolioId: portfolio.id });
    // 202 Accepted — staged, not applied
    expect(created.status).toBe(202);
    expect(created.body.pending).toBe(true);

    // Not yet a real candidate
    expect(await prisma.candidate.count({ where: { name: 'Pending Person' } })).toBe(0);

    const superCookie = await loginCookie('super@test.com');
    const queue = await api()
      .get('/api/v1/change-requests?status=PENDING')
      .set('Cookie', superCookie);
    expect(queue.body.data).toHaveLength(1);
    const changeId = queue.body.data[0].id as string;

    const approve = await api()
      .post(`/api/v1/change-requests/${changeId}/approve`)
      .set('Cookie', superCookie)
      .send({ note: 'approved' });
    expect(approve.status).toBe(200);

    // Now it exists
    expect(await prisma.candidate.count({ where: { name: 'Pending Person' } })).toBe(1);
  });

  it('forbids an admin from deleting resources', async () => {
    const { candidates } = await createElectionFixture();
    await createUser(Role.ADMIN, { email: 'admin2@test.com' });
    const adminCookie = await loginCookie('admin2@test.com');

    const res = await api()
      .delete(`/api/v1/candidates/${candidates[0].id}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(403);
    // Still present (soft-delete only by super-admin)
    expect(await prisma.candidate.count()).toBe(2);
  });

  it('lets a super-admin apply a change immediately', async () => {
    const { election, portfolio } = await createElectionFixture();
    await createUser(Role.SUPER_ADMIN, { email: 'super2@test.com' });
    const superCookie = await loginCookie('super2@test.com');

    const res = await api()
      .post('/api/v1/candidates')
      .set('Cookie', superCookie)
      .send({ electionId: election.id, name: 'Direct Person', portfolioId: portfolio.id });
    expect(res.status).toBe(201);
    expect(await prisma.candidate.count({ where: { name: 'Direct Person' } })).toBe(1);
  });
});
