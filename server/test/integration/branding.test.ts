// The organization's identity is what the sign-in pages and the published
// results carry, and both are reached without a session - so the endpoint that
// serves it has to answer signed out, and has to answer at all when the
// deployment has never configured one.
import { beforeEach, describe, expect, it } from 'vitest';

import { api, bodyOf, prisma, resetDb } from '../helpers.js';

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
        slug: 'ashesi-sc',
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
    await prisma.organization.create({ data: { name: 'Org', slug: 'org' } });
    const res = await api().get('/api/v1/branding');
    const payload = bodyOf<{ data: Record<string, unknown> }>(res).data;
    for (const retired of ['primaryColor', 'accentColor', 'timezone', 'locale', 'settings', 'slug']) {
      expect(payload).not.toHaveProperty(retired);
    }
  });
});
