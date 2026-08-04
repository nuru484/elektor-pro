// test/integration/build5-refinements.test.ts
//
// Build 5 refinements: candidate bulk creation + file import preview,
// per-election results role visibility, and election list date filters.
import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import {
  api,
  bodyOf,
  createElectionFixture,
  createUser,
  createVoterFixture,
  loginCookie,
  prisma,
  resetDb,
  toCookieHeader,
} from '../helpers.js';

const superAdminCookie = async (): Promise<string> => {
  await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
  return loginCookie('super@test.com');
};

describe('candidate bulk creation + import preview', () => {
  beforeEach(resetDb);

  it('previews a nominations CSV: portfolio matching, dupes, and problems', async () => {
    const cookie = await superAdminCookie();
    const { candidates, election, portfolio } = await createElectionFixture();

    const csv = [
      'Candidate,Position,Nickname,Email',
      `Efua Owusu,${portfolio.name},The Builder,efua@test.com`,
      'Kwame Asante,Nonexistent Office,,kwame@test.com',
      `Efua Owusu,${portfolio.name},,efua2@test.com`,
      `${candidates[0].name},${portfolio.name},,taken@test.com`,
    ].join('\n');

    const res = await api()
      .post('/api/v1/candidates/import/preview')
      .set('Cookie', cookie)
      .field('electionId', election.id)
      .attach('file', Buffer.from(csv), { contentType: 'text/csv', filename: 'noms.csv' });
    expect(res.status).toBe(200);
    const { data } = bodyOf<{
      data: {
        errors: { field: string; row: number }[];
        rows: { name: string; portfolioId: string }[];
        summary: { invalid: number; total: number; valid: number };
      };
    }>(res);

    expect(data.summary).toEqual({ invalid: 3, total: 4, valid: 1 });
    expect(data.rows[0]).toMatchObject({ name: 'Efua Owusu', portfolioId: portfolio.id });
    const flagged = data.errors.map((e) => `${String(e.row)}:${e.field}`);
    expect(flagged).toContain('2:portfolio'); // unknown portfolio
    expect(flagged).toContain('3:name'); // duplicate in file
    expect(flagged).toContain('4:name'); // already contesting
  });

  it('bulk-creates candidates through maker-checker', async () => {
    const cookie = await superAdminCookie();
    const { election, portfolio } = await createElectionFixture();

    const res = await api()
      .post('/api/v1/candidates/bulk')
      .set('Cookie', cookie)
      .send({
        candidates: [
          {
            electionId: election.id,
            email: 'akosua@test.com',
            name: 'Akosua Frimpong',
            portfolioId: portfolio.id,
          },
          {
            electionId: election.id,
            email: 'yaw.darko@test.com',
            name: 'Yaw Darko',
            nickname: 'The Bridge',
            portfolioId: portfolio.id,
          },
        ],
      });
    expect(res.status).toBe(201);

    const created = await prisma.candidate.count({
      where: { electionId: election.id, name: { in: ['Akosua Frimpong', 'Yaw Darko'] } },
    });
    expect(created).toBe(2);
  });
});

describe('per-election results role visibility', () => {
  beforeEach(resetDb);

  const voterLogin = async (identifier: string): Promise<string> => {
    const reqRes = await api().post('/api/v1/voter/otp/request').send({ identifier });
    const code = bodyOf<{ data: { devCode: string } }>(reqRes).data.devCode;
    const verifyRes = await api()
      .post('/api/v1/voter/otp/verify')
      .send({ code, identifier });
    return toCookieHeader(verifyRes.headers['set-cookie']);
  };

  it('lets a role listed in settings.resultsVisibleToRoles see unpublished results', async () => {
    const { election } = await createElectionFixture();
    // ON_CLOSE + still open: voters normally cannot see results yet.
    await prisma.election.update({
      data: { resultsPolicy: 'ON_CLOSE' },
      where: { id: election.id },
    });
    await createVoterFixture('VIS1', '+233550000051');
    const cookie = await voterLogin('VIS1');

    const before = await api()
      .get(`/api/v1/elections/${election.id}/results`)
      .set('Cookie', cookie);
    expect(before.status).toBe(403);

    await prisma.election.update({
      data: { settings: { resultsVisibleToRoles: ['VOTER'] } },
      where: { id: election.id },
    });
    const after = await api()
      .get(`/api/v1/elections/${election.id}/results`)
      .set('Cookie', cookie);
    expect(after.status).toBe(200);

    // The override never opens results to the anonymous public.
    const anonymous = await api().get(`/api/v1/elections/${election.id}/results`);
    expect(anonymous.status).toBe(403);
  });
});

describe('election list date filters', () => {
  beforeEach(resetDb);

  it('narrows elections by their start date window', async () => {
    const cookie = await superAdminCookie();
    const day = 86_400_000;
    await prisma.election.createMany({
      data: [
        {
          endDate: new Date('2026-01-10'),
          name: 'January Poll',
          slug: 'jan-poll',
          startDate: new Date('2026-01-05'),
        },
        {
          endDate: new Date(Date.now() + day),
          name: 'Current Poll',
          slug: 'current-poll',
          startDate: new Date(Date.now() - day),
        },
      ],
    });

    const filtered = await api()
      .get('/api/v1/elections?from=2026-01-01&to=2026-01-31')
      .set('Cookie', cookie);
    expect(filtered.status).toBe(200);
    const names = bodyOf<{ data: { name: string }[] }>(filtered).data.map((e) => e.name);
    expect(names).toEqual(['January Poll']);
  });
});
