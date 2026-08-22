// test/integration/build9.test.ts
//
// Election cloning (structure only, fresh DRAFT), open/results
// announcements to eligible voters (mock channels; audited), and the
// one-page election report.
import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { announceElectionOpened } from '../../src/services/notifications/election-announcements.service.js';
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

describe('election cloning', () => {
  beforeEach(resetDb);

  it('clones structure into a fresh DRAFT: portfolios, groups, criteria - not people', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();
    const category = await prisma.groupCategory.create({
      data: { code: 'fac', name: 'Faculty' },
    });
    const group = await prisma.group.create({
      data: { categoryId: category.id, code: 'sci', name: 'Science' },
    });
    await prisma.election.update({
      data: { eligibilityMode: 'GROUPS', vettingEnabled: true, vettingPassPercent: 60 },
      where: { id: election.id },
    });
    await prisma.electionEligibility.create({
      data: { electionId: election.id, groupId: group.id },
    });
    await prisma.vettingCriterion.create({
      data: { electionId: election.id, maxScore: 20, name: 'Interview' },
    });

    const res = await api()
      .post(`/api/v1/elections/${election.id}/clone`)
      .set('Cookie', cookie)
      .send({
        endDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        name: 'Test Election 2027',
        startDate: new Date(Date.now() + 29 * 86_400_000).toISOString(),
      });
    expect(res.status).toBe(201);
    const cloneId = bodyOf<{ data: { id: string } }>(res).data.id;

    const clone = await prisma.election.findUnique({
      include: {
        candidates: true,
        eligibilityGroups: true,
        portfolios: true,
        vettingCriteria: true,
        voterElections: true,
      },
      where: { id: cloneId },
    });
    expect(clone?.status).toBe('DRAFT');
    expect(clone?.eligibilityMode).toBe('GROUPS');
    expect(clone?.vettingPassPercent).toBe(60);
    expect(clone?.portfolios).toHaveLength(1);
    expect(clone?.eligibilityGroups).toHaveLength(1);
    expect(clone?.vettingCriteria).toHaveLength(1);
    // People do not ride the clone: a fresh run starts clean.
    expect(clone?.candidates).toHaveLength(0);
    expect(clone?.voterElections).toHaveLength(0);
    expect(clone?.slug).not.toBe(election.slug);
  });
});

describe('announcements and report', () => {
  beforeEach(resetDb);

  it('announces an opening to eligible voters and audits the batch', async () => {
    const { election } = await createElectionFixture();
    await createVoterFixture('ANN1', '+233550000111');
    await createVoterFixture('ANN2', '+233550000112');

    await announceElectionOpened(election.id);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'election.open_announced', entityId: election.id },
    });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({ attempted: 2, failed: 0 });
  });

  it('serves the one-page report to staff and refuses voters', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();

    const res = await api()
      .get(`/api/v1/elections/${election.id}/report`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const report = bodyOf<{
      data: {
        candidates: Record<string, number>;
        chain: { valid: boolean };
        portfolios: number;
        turnout: { eligible: number };
      };
    }>(res).data;
    expect(report.portfolios).toBe(1);
    expect(report.chain.valid).toBe(true);
    expect(report.candidates.QUALIFIED).toBe(2);

    // Voters cannot read operational counts.
    const { user } = await createVoterFixture('REP1', '+233550000113');
    await prisma.user.update({
      data: { email: 'rep1@test.com' },
      where: { id: user.id },
    });
    const otpReq = await api()
      .post('/api/v1/voter/otp/request')
      .send({ identifier: 'REP1' });
    const code = bodyOf<{ data: { devCode: string } }>(otpReq).data.devCode;
    const verify = await api()
      .post('/api/v1/voter/otp/verify')
      .send({ code, identifier: 'REP1' });
    const voterCookie = toCookieHeader(verify.headers['set-cookie']);
    const refused = await api()
      .get(`/api/v1/elections/${election.id}/report`)
      .set('Cookie', voterCookie);
    expect(refused.status).toBe(403);
  });
});

describe('voter history and portal hiding', () => {
  beforeEach(resetDb);

  it('records that a voter voted without linking them to their ballot, and hides hidden elections', async () => {
    const { candidates, election, portfolio } = await createElectionFixture();
    await createVoterFixture('HIST1', '+233550000121');

    const reqRes = await api()
      .post('/api/v1/voter/otp/request')
      .send({ identifier: 'HIST1' });
    const code = bodyOf<{ data: { devCode: string } }>(reqRes).data.devCode;
    const verify = await api()
      .post('/api/v1/voter/otp/verify')
      .send({ code, identifier: 'HIST1' });
    const cookie = toCookieHeader(verify.headers['set-cookie']);

    const castRes = await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send({
        selections: [{ candidateIds: [candidates[0].id], portfolioId: portfolio.id }],
      });
    expect(castRes.status).toBe(201);
    const receipt = bodyOf<{ data: { receiptCode: string } }>(castRes).data.receiptCode;
    // The receipt is handed to the voter and kept nowhere else.
    expect(receipt).toBeTruthy();

    // History records THAT they voted and when - never what they voted.
    const history = await api().get('/api/v1/voter/history').set('Cookie', cookie);
    expect(history.status).toBe(200);
    const rows = bodyOf<{
      data: {
        choices: null | unknown[];
        election: { id: string };
        receiptCode: null | string;
        votedAt: null | string;
      }[];
    }>(history).data;
    expect(rows).toHaveLength(1);
    expect(rows[0].election.id).toBe(election.id);
    expect(rows[0].votedAt).toBeTruthy();
    // Secret ballot: the fields exist on the shape an open ballot fills in,
    // but there is nothing to fill them with - no choices, and no receipt to
    // join back to the ballot.
    expect(rows[0].choices).toBeNull();
    expect(rows[0].receiptCode).toBeNull();

    // And nothing in the database links the voter's row to their ballot.
    const entry = await prisma.voterElection.findFirst({
      where: { election: { id: election.id } },
    });
    expect(Object.values(entry ?? {})).not.toContain(receipt);

    // The voter can still prove their own ballot, using the code they kept.
    const verified = await api().get(
      `/api/v1/elections/${election.id}/receipts/${receipt}`,
    );
    expect(verified.status).toBe(200);
    expect(
      bodyOf<{ data: { integrityValid: boolean } }>(verified).data.integrityValid,
    ).toBe(true);

    // Hiding the election clears it from the voter portal - history included.
    await prisma.election.update({
      data: { settings: { hiddenFromVoters: true } },
      where: { id: election.id },
    });
    const hiddenList = await api().get('/api/v1/voter/elections').set('Cookie', cookie);
    expect(bodyOf<{ data: unknown[] }>(hiddenList).data).toHaveLength(0);
    const hiddenHistory = await api().get('/api/v1/voter/history').set('Cookie', cookie);
    expect(bodyOf<{ data: unknown[] }>(hiddenHistory).data).toHaveLength(0);
  });
});
