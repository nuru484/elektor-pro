import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { api, bodyOf, createUser, loginCookie, prisma, resetDb } from '../helpers.js';

const makeDeletedVoter = async (name: string, voterId: string, deletedAt = new Date()) =>
  prisma.voter.create({
    data: { deletedAt, name, voterId },
  });

describe('deleted-records manager', () => {
  beforeEach(resetDb);

  it('is super-admin only', async () => {
    await createUser(Role.ADMIN, { email: 'admin@test.com' });
    const cookie = await loginCookie('admin@test.com');
    expect((await api().get('/api/v1/admin/deleted').set('Cookie', cookie)).status).toBe(403);
  });

  it('summarizes and lists soft-deleted rows with date filtering', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    const cookie = await loginCookie('super@test.com');

    await makeDeletedVoter('Old Delete', 'V-1', new Date('2026-01-10T10:00:00Z'));
    await makeDeletedVoter('New Delete', 'V-2', new Date('2026-08-01T10:00:00Z'));
    await prisma.voter.create({ data: { name: 'Alive', voterId: 'V-3' } });

    const summary = await api().get('/api/v1/admin/deleted').set('Cookie', cookie);
    expect(summary.status).toBe(200);
    const counts = bodyOf<{ data: { count: number; resource: string }[] }>(summary).data;
    expect(counts.find((c) => c.resource === 'voters')?.count).toBe(2);

    const all = await api().get('/api/v1/admin/deleted/voters').set('Cookie', cookie);
    expect(bodyOf<{ data: { label: string }[] }>(all).data).toHaveLength(2);

    const windowed = await api()
      .get('/api/v1/admin/deleted/voters?from=2026-08-01&to=2026-08-01')
      .set('Cookie', cookie);
    const rows = bodyOf<{ data: { label: string; meta: string }[] }>(windowed).data;
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('New Delete');
    expect(rows[0].meta).toBe('V-2');
  });

  it('restores a soft-deleted row and audits it', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    const cookie = await loginCookie('super@test.com');
    const voter = await makeDeletedVoter('Comeback', 'V-9');

    const res = await api()
      .post(`/api/v1/admin/deleted/voters/${voter.id}/restore`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);

    const restored = await prisma.voter.findUnique({ where: { id: voter.id } });
    expect(restored?.deletedAt).toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { action: 'admin.record_restored', entityId: voter.id },
      }),
    ).toBe(1);

    // Restoring a live row is a 400, not a silent no-op
    const again = await api()
      .post(`/api/v1/admin/deleted/voters/${voter.id}/restore`)
      .set('Cookie', cookie);
    expect(again.status).toBe(400);
  });

  it('purges a soft-deleted row permanently (hard delete) and audits it', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    const cookie = await loginCookie('super@test.com');
    const voter = await makeDeletedVoter('Gone Forever', 'V-8');

    const res = await api()
      .delete(`/api/v1/admin/deleted/voters/${voter.id}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);

    // findUnique bypasses the soft-delete filter - the row is truly gone.
    expect(await prisma.voter.findUnique({ where: { id: voter.id } })).toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { action: 'admin.record_purged', entityId: voter.id },
      }),
    ).toBe(1);

    // A live row cannot be purged.
    const alive = await prisma.voter.create({ data: { name: 'Safe', voterId: 'V-7' } });
    const refuse = await api()
      .delete(`/api/v1/admin/deleted/voters/${alive.id}`)
      .set('Cookie', cookie);
    expect(refuse.status).toBe(400);
  });

  it('rejects unknown resources', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    const cookie = await loginCookie('super@test.com');
    expect(
      (await api().get('/api/v1/admin/deleted/nonsense').set('Cookie', cookie)).status,
    ).toBe(400);
  });
});
