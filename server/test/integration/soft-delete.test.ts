import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { createUser, prisma, resetDb } from '../helpers.js';

describe('soft-delete Prisma extension', () => {
  beforeEach(resetDb);

  it('rewrites delete to set deletedAt instead of removing the row', async () => {
    const user = await createUser(Role.ADMIN);
    await prisma.user.delete({ where: { id: user.id } });

    // findUnique is the deliberate seam that still sees soft-deleted rows.
    const raw = await prisma.user.findUnique({ where: { id: user.id } });
    expect(raw).not.toBeNull();
    expect(raw?.deletedAt).toBeInstanceOf(Date);
  });

  it('scopes reads to non-deleted rows by default', async () => {
    const keep = await createUser(Role.ADMIN, { email: 'keep@test.com' });
    const gone = await createUser(Role.ADMIN, { email: 'gone@test.com' });
    await prisma.user.delete({ where: { id: gone.id } });

    const found = await prisma.user.findMany({ where: { role: Role.ADMIN } });
    expect(found.map((u) => u.id)).toEqual([keep.id]);
    expect(await prisma.user.count({ where: { role: Role.ADMIN } })).toBe(1);
    expect(await prisma.user.findFirst({ where: { id: gone.id } })).toBeNull();
  });

  it('lets an explicit deletedAt predicate opt back in to deleted rows', async () => {
    const gone = await createUser(Role.ADMIN, { email: 'gone2@test.com' });
    await prisma.user.delete({ where: { id: gone.id } });

    const deleted = await prisma.user.findMany({
      where: { deletedAt: { not: null } },
    });
    expect(deleted.map((u) => u.id)).toContain(gone.id);
  });

  it('rewrites deleteMany to a bulk soft delete', async () => {
    await createUser(Role.AGENT, { email: 'agent1@test.com' });
    await createUser(Role.AGENT, { email: 'agent2@test.com' });

    await prisma.user.deleteMany({ where: { role: Role.AGENT } });

    expect(await prisma.user.count({ where: { role: Role.AGENT } })).toBe(0);
    const stillThere = await prisma.user.findMany({
      where: { deletedAt: { not: null }, role: Role.AGENT },
    });
    expect(stillThere).toHaveLength(2);
  });

  it('does not scope models without deletedAt (e.g. ballots)', async () => {
    // Organization has no deletedAt column; a plain create + findMany must work
    // untouched by the extension.
    await prisma.organization.create({
      data: { name: 'Test Org', slug: `org-${Date.now()}` },
    });
    expect(await prisma.organization.count()).toBe(1);
  });
});
