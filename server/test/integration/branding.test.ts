// The organization's identity is what the sign-in pages and the published
// results carry, and both are reached without a session - so the endpoint that
// serves it has to answer signed out, and has to answer at all when the
// deployment has never configured one.
import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { api, bodyOf, createUser, loginCookie, prisma, resetDb } from '../helpers.js';

interface BrandingBody {
  data: null | {
    faviconUrl: null | string;
    logoUrl: null | string;
    name: string;
    supportEmail: null | string;
    supportPhone: null | string;
    website: null | string;
  };
}

describe('public branding', () => {
  beforeEach(resetDb);

  it('serves the organization identity without a session', async () => {
    await prisma.organization.create({
      data: {
        logoUrl: 'https://res.cloudinary.com/demo/logo.png',
        name: 'Ashesi Student Council',
        supportEmail: 'elections@ashesi.edu.gh',
        supportPhone: '+233 30 000 0000',
      },
    });

    const res = await api().get('/api/v1/branding');
    expect(res.status).toBe(200);
    const body = bodyOf<BrandingBody>(res);
    expect(body.data?.name).toBe('Ashesi Student Council');
    expect(body.data?.logoUrl).toBe('https://res.cloudinary.com/demo/logo.png');
    expect(body.data?.supportEmail).toBe('elections@ashesi.edu.gh');
  });

  it('answers with null rather than failing when no organization is configured', async () => {
    const res = await api().get('/api/v1/branding');
    expect(res.status).toBe(200);
    expect(bodyOf<BrandingBody>(res).data).toBeNull();
  });

  it('does not expose the retired colour, locale or timezone columns', async () => {
    await prisma.organization.create({ data: { name: 'Org' } });
    const res = await api().get('/api/v1/branding');
    const payload = bodyOf<{ data: Record<string, unknown> }>(res).data;
    for (const retired of ['primaryColor', 'accentColor', 'timezone', 'locale', 'settings', 'slug']) {
      expect(payload).not.toHaveProperty(retired);
    }
  });
});

/**
 * Clearing a mark is how an organization goes back to the platform's own.
 * The column has to end up NULL rather than at some default URL: every reader
 * - the client hook, the server metadata, the tab icon - resolves null to the
 * current default, and writing today's default into the row would outlive it.
 */
describe('clearing a branding mark', () => {
  beforeEach(resetDb);

  // The email is spelled out rather than read back off the row: User.email is
  // nullable on the model, and a login helper cannot take a maybe-null.
  const ADMIN_EMAIL = 'branding-admin@test.com';
  const authed = async () => {
    await createUser(Role.SUPER_ADMIN, { email: ADMIN_EMAIL });
    return loginCookie(ADMIN_EMAIL);
  };

  it('nulls the logo and leaves the rest of the identity alone', async () => {
    await prisma.organization.create({
      data: {
        faviconUrl: 'https://res.cloudinary.com/demo/favicon.png',
        logoUrl: 'https://res.cloudinary.com/demo/logo.png',
        name: 'Ashesi Student Council',
      },
    });
    const cookie = await authed();

    const res = await api()
      .delete('/api/v1/organization/logo')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);

    const org = await prisma.organization.findFirstOrThrow();
    expect(org.logoUrl).toBeNull();
    // Only the mark asked for: clearing one must not take the other with it.
    expect(org.faviconUrl).toBe('https://res.cloudinary.com/demo/favicon.png');
    expect(org.name).toBe('Ashesi Student Council');
  });

  it('nulls the favicon', async () => {
    await prisma.organization.create({
      data: { faviconUrl: 'https://res.cloudinary.com/demo/favicon.png', name: 'Org' },
    });
    const cookie = await authed();

    const res = await api()
      .delete('/api/v1/organization/favicon')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect((await prisma.organization.findFirstOrThrow()).faviconUrl).toBeNull();
  });

  it('is a no-op rather than an error when nothing was set', async () => {
    await prisma.organization.create({ data: { name: 'Org' } });
    const cookie = await authed();

    const res = await api()
      .delete('/api/v1/organization/logo')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect((await prisma.organization.findFirstOrThrow()).logoUrl).toBeNull();
  });

  it('refuses a caller without a session', async () => {
    await prisma.organization.create({
      data: { logoUrl: 'https://res.cloudinary.com/demo/logo.png', name: 'Org' },
    });

    const res = await api().delete('/api/v1/organization/logo');
    expect(res.status).toBe(401);
    // And the mark is still there.
    expect((await prisma.organization.findFirstOrThrow()).logoUrl).not.toBeNull();
  });
});
