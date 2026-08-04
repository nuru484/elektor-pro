import { beforeEach, describe, expect, it } from 'vitest';

import { ChangeAction, ChangeEntity, Role } from '../../generated/prisma/client.js';
import { api, bodyOf, createUser, loginCookie, prisma, resetDb } from '../helpers.js';

describe('change request list filters', () => {
  beforeEach(resetDb);

  it('filters by created date window (whole days, inclusive)', async () => {
    const admin = await createUser(Role.ADMIN, { email: 'admin@test.com' });
    const cookie = await loginCookie('admin@test.com');

    const base = {
      action: ChangeAction.CREATE,
      entity: ChangeEntity.VOTER,
      payload: { name: 'X' },
      requestedById: admin.id,
    };
    await prisma.changeRequest.create({
      data: { ...base, createdAt: new Date('2026-07-01T09:00:00Z') },
    });
    await prisma.changeRequest.create({
      data: { ...base, createdAt: new Date('2026-08-02T23:30:00Z') },
    });

    const windowed = await api()
      .get('/api/v1/change-requests?from=2026-08-02&to=2026-08-02')
      .set('Cookie', cookie);
    expect(windowed.status).toBe(200);
    expect(bodyOf<{ data: unknown[] }>(windowed).data).toHaveLength(1);

    const junk = await api()
      .get('/api/v1/change-requests?from=not-a-date')
      .set('Cookie', cookie);
    expect(junk.status).toBe(200);
    expect(bodyOf<{ data: unknown[] }>(junk).data).toHaveLength(2);
  });
});
