import { beforeEach, describe, expect, it } from 'vitest';

import {
  api,
  createElectionFixture,
  createVoterFixture,
  prisma,
  resetDb,
  toCookieHeader,
} from '../helpers.js';

const voterLogin = async (identifier: string): Promise<string> => {
  const reqRes = await api()
    .post('/api/v1/voter/otp/request')
    .send({ identifier });
  const code = reqRes.body.data.devCode as string;
  const verifyRes = await api()
    .post('/api/v1/voter/otp/verify')
    .send({ code, identifier });
  return toCookieHeader(verifyRes.headers['set-cookie']);
};

describe('voter OTP + secret ballot voting', () => {
  beforeEach(resetDb);

  it('runs the full flow: OTP login → ballot → cast → receipt', async () => {
    const { candidates, election, portfolio } = await createElectionFixture();
    await createVoterFixture('STU1', '+233550000001');

    const cookie = await voterLogin('STU1');
    expect(cookie).toContain('accessToken');

    const ballotRes = await api()
      .get(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie);
    expect(ballotRes.status).toBe(200);
    expect(ballotRes.body.data.portfolios).toHaveLength(1);
    expect(ballotRes.body.data.hasVoted).toBe(false);

    const castRes = await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send({
        selections: [{ candidateIds: [candidates[0].id], portfolioId: portfolio.id }],
      });
    expect(castRes.status).toBe(201);
    const receipt = castRes.body.data.receiptCode as string;
    expect(receipt).toBeTruthy();

    // Receipt verifies and proves chain integrity.
    const receiptRes = await api().get(
      `/api/v1/elections/${election.id}/receipts/${receipt}`,
    );
    expect(receiptRes.status).toBe(200);
    expect(receiptRes.body.data.integrityValid).toBe(true);
    expect(receiptRes.body.data.choices[0].candidate).toBe('Alice');
  });

  it('enforces one person, one vote', async () => {
    const { candidates, election, portfolio } = await createElectionFixture();
    await createVoterFixture('STU2', '+233550000002');
    const cookie = await voterLogin('STU2');

    const payload = {
      selections: [{ candidateIds: [candidates[0].id], portfolioId: portfolio.id }],
    };
    const first = await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send(payload);
    expect(second.status).toBe(409);

    // Exactly one ballot was recorded.
    const ballots = await prisma.ballot.count({ where: { electionId: election.id } });
    expect(ballots).toBe(1);
  });

  it('keeps ballots anonymous (no voter linkage on the ballot)', async () => {
    const { candidates, election, portfolio } = await createElectionFixture();
    const { voter } = await createVoterFixture('STU3', '+233550000003');
    const cookie = await voterLogin('STU3');
    await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send({ selections: [{ candidateIds: [candidates[1].id], portfolioId: portfolio.id }] });

    // Turnout is tracked, but the ballot itself carries no voter id.
    const voterElection = await prisma.voterElection.findFirst({
      where: { voterId: voter.id },
    });
    expect(voterElection?.hasVoted).toBe(true);
    const ballot = await prisma.ballot.findFirst({ where: { electionId: election.id } });
    expect(Object.keys(ballot ?? {})).not.toContain('voterId');
  });
});
