// test/integration/accreditation-desk.test.ts
//
// The accreditation desk: voter lookup, check-in with one-time
// voting codes, single-use code sign-in, revocation, and live turnout.
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

describe('accreditation desk', () => {
  beforeEach(resetDb);

  it('searches voters with their standing for the election', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();
    const { voter } = await createVoterFixture('DESK1', '+233550000071');
    await prisma.voterElection.create({
      data: { electionId: election.id, isEligible: false, voterId: voter.id },
    });

    const res = await api()
      .get(`/api/v1/elections/${election.id}/accreditation/search?query=DESK1`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const rows = bodyOf<{
      data: { accreditedAt: null | string; eligible: boolean; voterId: string }[];
    }>(res).data;
    expect(rows).toHaveLength(1);
    // Explicit exclusion beats the ALL_VOTERS mode.
    expect(rows[0]).toMatchObject({ accreditedAt: null, eligible: false, voterId: 'DESK1' });

    // Below two characters the desk falls back to the eligible register so
    // the page is never empty (ALL_VOTERS mode: everyone, A-Z).
    const short = await api()
      .get(`/api/v1/elections/${election.id}/accreditation/search?query=D`)
      .set('Cookie', cookie);
    const fallback = bodyOf<{ data: { voterId: string }[] }>(short).data;
    expect(fallback.map((r) => r.voterId)).toContain('DESK1');
  });

  it('accredits with a one-time code, signs in with it exactly once', async () => {
    const cookie = await superAdminCookie();
    const { candidates, election, portfolio } = await createElectionFixture();
    await prisma.election.update({
      data: { accreditationRequired: true, voteCodeEnabled: true },
      where: { id: election.id },
    });
    const { voter } = await createVoterFixture('CODE1', '+233550000072');

    const accredited = await api()
      .post(`/api/v1/elections/${election.id}/voters/${voter.id}/accredit`)
      .set('Cookie', cookie);
    expect(accredited.status).toBe(200);
    const { voteCode } = bodyOf<{ data: { voteCode?: string } }>(accredited).data;
    expect(voteCode).toBeTruthy();
    // Only the hash is stored.
    const entry = await prisma.voterElection.findUnique({
      where: { voterId_electionId: { electionId: election.id, voterId: voter.id } },
    });
    expect(entry?.voteCodeHash).toBeTruthy();
    expect(entry?.voteCodeHash).not.toBe(voteCode);

    // The code signs the voter in - and works exactly once.
    const login = await api()
      .post('/api/v1/voter/code-login')
      .send({ code: voteCode, voterId: 'CODE1' });
    expect(login.status).toBe(200);
    const voterCookie = toCookieHeader(login.headers['set-cookie']);

    const replay = await api()
      .post('/api/v1/voter/code-login')
      .send({ code: voteCode, voterId: 'CODE1' });
    expect(replay.status).toBe(400);
    expect(bodyOf<{ code?: string }>(replay).code).toBe('INVALID_VOTE_CODE');

    // The session votes normally (accreditation already satisfied).
    const cast = await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', voterCookie)
      .send({
        selections: [{ candidateIds: [candidates[0].id], portfolioId: portfolio.id }],
      });
    expect(cast.status).toBe(201);
  });

  it('revokes a mistaken accreditation but never after a vote', async () => {
    const cookie = await superAdminCookie();
    const { candidates, election, portfolio } = await createElectionFixture();
    const first = await createVoterFixture('REV1', '+233550000073');

    await api()
      .post(`/api/v1/elections/${election.id}/voters/${first.voter.id}/accredit`)
      .set('Cookie', cookie);
    const revoked = await api()
      .delete(`/api/v1/elections/${election.id}/voters/${first.voter.id}/accredit`)
      .set('Cookie', cookie);
    expect(revoked.status).toBe(200);
    const cleared = await prisma.voterElection.findUnique({
      where: {
        voterId_electionId: { electionId: election.id, voterId: first.voter.id },
      },
    });
    expect(cleared?.accreditedAt).toBeNull();

    // After voting, accreditation is a fact of record.
    const otpReq = await api()
      .post('/api/v1/voter/otp/request')
      .send({ identifier: 'REV1' });
    const code = bodyOf<{ data: { devCode: string } }>(otpReq).data.devCode;
    const verify = await api()
      .post('/api/v1/voter/otp/verify')
      .send({ code, identifier: 'REV1' });
    const voterCookie = toCookieHeader(verify.headers['set-cookie']);
    await api()
      .post(`/api/v1/elections/${election.id}/voters/${first.voter.id}/accredit`)
      .set('Cookie', cookie);
    await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', voterCookie)
      .send({
        selections: [{ candidateIds: [candidates[1].id], portfolioId: portfolio.id }],
      });
    const refused = await api()
      .delete(`/api/v1/elections/${election.id}/voters/${first.voter.id}/accredit`)
      .set('Cookie', cookie);
    expect(refused.status).toBe(409);
    expect(bodyOf<{ code?: string }>(refused).code).toBe('ALREADY_VOTED');
  });

  it('reports live turnout to the roles allowed to see it', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();
    await createVoterFixture('TURN1', '+233550000074');
    const { voter } = await createVoterFixture('TURN2', '+233550000075');
    await api()
      .post(`/api/v1/elections/${election.id}/voters/${voter.id}/accredit`)
      .set('Cookie', cookie);

    const res = await api()
      .get(`/api/v1/elections/${election.id}/turnout`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const turnout = bodyOf<{
      data: { accredited: number; eligible: number; voted: number };
    }>(res).data;
    expect(turnout.accredited).toBe(1);
    expect(turnout.voted).toBe(0);
    expect(turnout.eligible).toBeGreaterThanOrEqual(2);

    // A CANDIDATE with no grant is refused.
    await createUser(Role.CANDIDATE, { email: 'nobody@test.com' });
    const outsiderCookie = await loginCookie('nobody@test.com');
    const refused = await api()
      .get(`/api/v1/elections/${election.id}/turnout`)
      .set('Cookie', outsiderCookie);
    expect(refused.status).toBe(403);
  });
});
