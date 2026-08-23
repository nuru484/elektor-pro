import { beforeEach, describe, expect, it } from 'vitest';

import { Capability, Role } from '../../generated/prisma/client.js';
import { makeOrganizationBrandingService } from '../../src/services/domain/organization-branding.service.js';
import {
  api,
  bodyOf,
  createElectionFixture,
  createUser,
  loginCookie,
  makeTestDeps,
  prisma,
  resetDb,
} from '../helpers.js';

describe('Build 3 people APIs', () => {
  beforeEach(resetDb);

  it('creates an ACCREDITOR staff account', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    const cookie = await loginCookie('super@test.com');

    const res = await api().post('/api/v1/staff-users').set('Cookie', cookie).send({
      email: 'desk@test.com',
      firstName: 'Desk',
      lastName: 'Officer',
      role: Role.ACCREDITOR,
    });
    expect(res.status).toBe(201);
    // The system generates the password and returns it exactly once.
    const body = bodyOf<{ data: { temporaryPassword: string } }>(res);
    expect(body.data.temporaryPassword).toMatch(/^[a-zA-Z0-9]{12}$/);
    const created = await prisma.user.findFirst({ where: { email: 'desk@test.com' } });
    expect(created?.role).toBe(Role.ACCREDITOR);
    expect(created?.mustChangePassword).toBe(true);

    // The temp password signs in, and changing it clears the requirement.
    const deskCookie = await loginCookie('desk@test.com', body.data.temporaryPassword);
    const change = await api()
      .post('/api/v1/auth/password/change')
      .set('Cookie', deskCookie)
      .send({ currentPassword: body.data.temporaryPassword, newPassword: 'MyOwnPass123' });
    expect(change.status).toBe(200);
    const after = await prisma.user.findFirst({ where: { email: 'desk@test.com' } });
    expect(after?.mustChangePassword).toBe(false);
  });

  it('filters the staff list by role, status and creation date', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    const cookie = await loginCookie('super@test.com');
    await prisma.user.create({
      data: {
        createdAt: new Date('2026-01-05T10:00:00Z'),
        email: 'old-admin@test.com',
        firstName: 'Old',
        lastName: 'Admin',
        role: Role.ADMIN,
        status: 'SUSPENDED',
      },
    });

    const byStatus = await api()
      .get('/api/v1/staff-users?status=SUSPENDED')
      .set('Cookie', cookie);
    expect(bodyOf<{ data: { email: string }[] }>(byStatus).data).toHaveLength(1);

    const byDate = await api()
      .get('/api/v1/staff-users?from=2026-01-05&to=2026-01-05')
      .set('Cookie', cookie);
    expect(bodyOf<{ data: { email: string }[] }>(byDate).data).toHaveLength(1);

    const byRole = await api()
      .get('/api/v1/staff-users?role=CANDIDATE')
      .set('Cookie', cookie);
    expect(bodyOf<{ data: unknown[] }>(byRole).data).toHaveLength(0);
  });

  it('paginates agent assignments and grants with meta', async () => {
    await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    const agent = await createUser(Role.AGENT, { email: 'agent@test.com' });
    const cookie = await loginCookie('super@test.com');
    const { election } = await createElectionFixture();

    await api()
      .post('/api/v1/agents')
      .set('Cookie', cookie)
      .send({ electionId: election.id, userId: agent.id });

    const agents = await api().get('/api/v1/agents?limit=5').set('Cookie', cookie);
    const agentsBody = bodyOf<{ data: unknown[]; meta: { total: number } }>(agents);
    expect(agentsBody.meta.total).toBe(1);
    expect(agentsBody.data).toHaveLength(1);

    await api().post('/api/v1/grants').set('Cookie', cookie).send({
      capability: Capability.VIEW_RESULTS,
      userId: agent.id,
    });
    const grants = await api()
      .get(`/api/v1/grants?capability=${Capability.VIEW_RESULTS}`)
      .set('Cookie', cookie);
    const grantsBody = bodyOf<{ data: unknown[]; meta: { total: number } }>(grants);
    expect(grantsBody.meta.total).toBe(1);

    const none = await api()
      .get(`/api/v1/grants?capability=${Capability.CERTIFY_RESULTS}`)
      .set('Cookie', cookie);
    expect(bodyOf<{ meta: { total: number } }>(none).meta.total).toBe(0);
  });
});

describe('organization branding uploads', () => {
  beforeEach(resetDb);

  it('uploads a logo, cleans up the replaced asset, and audits', async () => {
    await prisma.organization.create({
      data: { name: 'Org' },
    });
    const superAdmin = await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
    const { deleted, deps, uploaded } = makeTestDeps();
    const service = makeOrganizationBrandingService(deps);

    const first = await service.updateBrandingImage(
      'logoUrl',
      { buffer: Buffer.from('img-1'), mimetype: 'image/png' },
      { id: superAdmin.id, role: superAdmin.role },
    );
    expect(first.logoUrl).toBe(uploaded[0]);

    const second = await service.updateBrandingImage(
      'logoUrl',
      { buffer: Buffer.from('img-2'), mimetype: 'image/png' },
      { id: superAdmin.id, role: superAdmin.role },
    );
    expect(second.logoUrl).toBe(uploaded[1]);
    // The replaced asset was reclaimed.
    expect(deleted).toContain(uploaded[0]);

    expect(
      await prisma.auditLog.count({ where: { action: 'organization.logo_updated' } }),
    ).toBe(2);
  });
});
