import { beforeEach, describe, expect, it } from 'vitest';

import { Capability, Role } from '../../generated/prisma/client.js';
import { invalidateRoleCapabilityCache } from '../../src/services/authorization/role-capability.service.js';
import {
  api,
  bodyOf,
  createElectionFixture,
  createUser,
  loginCookie,
  prisma,
  resetDb,
} from '../helpers.js';

interface MatrixBody {
  data: {
    catalog: { capabilities: { capability: string; label: string }[]; group: string }[];
    editableRoles: string[];
    matrix: Record<string, string[]>;
  };
}

describe('runtime permission matrix', () => {
  beforeEach(resetDb);

  it('returns the catalog and the seeded default matrix to a super-admin', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    const cookie = await loginCookie('super@test.com');

    const res = await api().get('/api/v1/permissions').set('Cookie', cookie);
    expect(res.status).toBe(200);

    const { data } = bodyOf<MatrixBody>(res);
    expect(data.editableRoles).toEqual(
      expect.arrayContaining([Role.ADMIN, Role.AGENT, Role.CANDIDATE, Role.ACCREDITOR]),
    );
    expect(data.matrix[Role.ADMIN]).toEqual(
      expect.arrayContaining([Capability.MANAGE_ELECTIONS, Capability.MANAGE_VOTERS]),
    );
    expect(data.matrix[Role.CANDIDATE]).toEqual([]);
    // Catalog covers every capability with a label
    const catalogCaps = data.catalog.flatMap((g) => g.capabilities.map((c) => c.capability));
    expect(new Set(catalogCaps)).toEqual(new Set(Object.values(Capability)));
  });

  it('rejects non-super-admins', async () => {
    await createUser(Role.ADMIN, { email: 'admin@test.com' });
    const cookie = await loginCookie('admin@test.com');
    expect((await api().get('/api/v1/permissions').set('Cookie', cookie)).status).toBe(403);
    expect(
      (
        await api()
          .put(`/api/v1/permissions/${Role.AGENT}`)
          .set('Cookie', cookie)
          .send({ capabilities: [Capability.VIEW_RESULTS] })
      ).status,
    ).toBe(403);
  });

  it('replaces a role\'s grants, audits it, and the new grants take effect', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    await createUser(Role.ADMIN, { email: 'admin@test.com' });
    const superCookie = await loginCookie('super@test.com');
    const adminCookie = await loginCookie('admin@test.com');
    const { election } = await createElectionFixture();

    // Admin can create a voter today (staged as a change request)
    const before = await api()
      .post('/api/v1/voters')
      .set('Cookie', adminCookie)
      .send({ electionIds: [election.id], name: 'Ama Voter', voterId: 'V-100' });
    expect([200, 201, 202]).toContain(before.status);

    // Revoke MANAGE_VOTERS (and everything else) from ADMIN
    const update = await api()
      .put(`/api/v1/permissions/${Role.ADMIN}`)
      .set('Cookie', superCookie)
      .send({ capabilities: [Capability.VIEW_RESULTS] });
    expect(update.status).toBe(200);
    invalidateRoleCapabilityCache();

    const after = await api()
      .post('/api/v1/voters')
      .set('Cookie', adminCookie)
      .send({ electionIds: [election.id], name: 'Kwesi Voter', voterId: 'V-101' });
    expect(after.status).toBe(403);

    // The edit is in the audit chain
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'permissions.role_updated', entityId: Role.ADMIN },
    });
    expect(audit).not.toBeNull();
  });

  it('lets a role granted APPROVE_CHANGES apply changes directly', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    await createUser(Role.ADMIN, { email: 'admin@test.com' });
    const superCookie = await loginCookie('super@test.com');
    const adminCookie = await loginCookie('admin@test.com');
    const { election } = await createElectionFixture();

    const grant = await api()
      .put(`/api/v1/permissions/${Role.ADMIN}`)
      .set('Cookie', superCookie)
      .send({
        capabilities: [Capability.MANAGE_VOTERS, Capability.APPROVE_CHANGES],
      });
    expect(grant.status).toBe(200);
    invalidateRoleCapabilityCache();

    // With APPROVE_CHANGES the admin's own create applies immediately (201),
    // not staged (202).
    const res = await api()
      .post('/api/v1/voters')
      .set('Cookie', adminCookie)
      .send({ electionIds: [election.id], name: 'Direct Voter', voterId: 'V-200' });
    expect(res.status).toBe(201);
    expect(await prisma.voter.count({ where: { voterId: 'V-200' } })).toBe(1);
  });

  it('refuses to edit non-editable roles and surfaces capabilities in /auth/me', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    await createUser(Role.AGENT, { email: 'agent@test.com' });
    const superCookie = await loginCookie('super@test.com');

    expect(
      (
        await api()
          .put(`/api/v1/permissions/${Role.SUPER_ADMIN}`)
          .set('Cookie', superCookie)
          .send({ capabilities: [] })
      ).status,
    ).toBe(400);

    const agentCookie = await loginCookie('agent@test.com');
    const me = await api().get('/api/v1/auth/me').set('Cookie', agentCookie);
    const { data } = bodyOf<{ data: { capabilities: string[] } }>(me);
    expect(data.capabilities).toEqual([Capability.VIEW_RESULTS]);
  });
});
