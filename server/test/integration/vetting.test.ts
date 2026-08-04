// test/integration/vetting.test.ts
//
// Build 6: nomination vetting - draft intake on vetting-enabled elections,
// criteria + scoring, qualification decisions with the lifecycle map, ballot
// visibility for qualified candidates only, and ballot-number assignment.
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

const voterLogin = async (identifier: string): Promise<string> => {
  const reqRes = await api().post('/api/v1/voter/otp/request').send({ identifier });
  const code = bodyOf<{ data: { devCode: string } }>(reqRes).data.devCode;
  const verifyRes = await api()
    .post('/api/v1/voter/otp/verify')
    .send({ code, identifier });
  return toCookieHeader(verifyRes.headers['set-cookie']);
};

describe('nomination vetting', () => {
  beforeEach(resetDb);

  it('runs the full flow: draft intake → criteria → scores → qualify → ballot', async () => {
    const cookie = await superAdminCookie();
    const { election, portfolio } = await createElectionFixture();
    await prisma.election.update({
      data: { vettingEnabled: true },
      where: { id: election.id },
    });

    // New nominations on a vetting-enabled election arrive as DRAFT.
    const created = await api()
      .post('/api/v1/candidates')
      .set('Cookie', cookie)
      .send({
        electionId: election.id,
        email: 'esi.cudjoe@test.com',
        name: 'Esi Cudjoe',
        portfolioId: portfolio.id,
      });
    expect(created.status).toBe(201);
    const candidateId = bodyOf<{ data: { id: string } }>(created).data.id;
    const draft = await prisma.candidate.findUnique({ where: { id: candidateId } });
    expect(draft?.status).toBe('DRAFT');

    // Draft candidates never reach a voter's ballot.
    await createVoterFixture('VET1', '+233550000061');
    const voterCookie = await voterLogin('VET1');
    const ballotBefore = bodyOf<{
      data: { portfolios: { candidates: { id: string }[] }[] };
    }>(
      await api()
        .get(`/api/v1/voter/elections/${election.id}/ballot`)
        .set('Cookie', voterCookie),
    );
    const idsBefore = ballotBefore.data.portfolios.flatMap((p) =>
      p.candidates.map((c) => c.id),
    );
    expect(idsBefore).not.toContain(candidateId);

    // Criteria + scores.
    const criterion = bodyOf<{ data: { id: string } }>(
      await api()
        .post(`/api/v1/elections/${election.id}/vetting/criteria`)
        .set('Cookie', cookie)
        .send({ maxScore: 20, name: 'Academic standing' }),
    ).data;
    const outOfRange = await api()
      .put(`/api/v1/candidates/${candidateId}/vetting/score`)
      .set('Cookie', cookie)
      .send({ criterionId: criterion.id, score: 25 });
    expect(outOfRange.status).toBe(400);
    expect(bodyOf<{ code?: string }>(outOfRange).code).toBe('SCORE_OUT_OF_RANGE');
    const scored = await api()
      .put(`/api/v1/candidates/${candidateId}/vetting/score`)
      .set('Cookie', cookie)
      .send({ criterionId: criterion.id, note: 'Strong record', score: 18 });
    expect(scored.status).toBe(200);

    const vetting = bodyOf<{
      data: { byCriterion: { average: null | number }[]; maxTotal: number; total: number };
    }>(
      await api()
        .get(`/api/v1/candidates/${candidateId}/vetting`)
        .set('Cookie', cookie),
    );
    expect(vetting.data.total).toBe(18);
    expect(vetting.data.maxTotal).toBe(20);

    // Decision: qualify with a note, then the candidate is on the ballot.
    const decided = await api()
      .post(`/api/v1/candidates/${candidateId}/status`)
      .set('Cookie', cookie)
      .send({ note: 'Cleared by the panel', status: 'QUALIFIED' });
    expect(decided.status).toBe(200);

    const ballotAfter = bodyOf<{
      data: { portfolios: { candidates: { id: string }[] }[] };
    }>(
      await api()
        .get(`/api/v1/voter/elections/${election.id}/ballot`)
        .set('Cookie', voterCookie),
    );
    const idsAfter = ballotAfter.data.portfolios.flatMap((p) =>
      p.candidates.map((c) => c.id),
    );
    expect(idsAfter).toContain(candidateId);
  });

  it('auto-decides by the pass mark once every criterion is scored', async () => {
    const cookie = await superAdminCookie();
    const { election, portfolio } = await createElectionFixture();
    await prisma.election.update({
      data: { vettingEnabled: true, vettingPassPercent: 60 },
      where: { id: election.id },
    });
    const criterionA = bodyOf<{ data: { id: string } }>(
      await api()
        .post(`/api/v1/elections/${election.id}/vetting/criteria`)
        .set('Cookie', cookie)
        .send({ maxScore: 10, name: 'Documents' }),
    ).data;
    const criterionB = bodyOf<{ data: { id: string } }>(
      await api()
        .post(`/api/v1/elections/${election.id}/vetting/criteria`)
        .set('Cookie', cookie)
        .send({ maxScore: 10, name: 'Interview' }),
    ).data;
    const created = await api()
      .post('/api/v1/candidates')
      .set('Cookie', cookie)
      .send({
        electionId: election.id,
        email: 'auto.nominee@test.com',
        name: 'Auto Nominee',
        portfolioId: portfolio.id,
      });
    const candidateId = bodyOf<{ data: { id: string } }>(created).data.id;

    // One criterion scored: still pending (no partial auto-decision).
    await api()
      .put(`/api/v1/candidates/${candidateId}/vetting/score`)
      .set('Cookie', cookie)
      .send({ criterionId: criterionA.id, score: 3 });
    let row = await prisma.candidate.findUnique({ where: { id: candidateId } });
    expect(row?.status).toBe('DRAFT');

    // Second criterion scored: 8/20 = 40% < 60% → auto-disqualified.
    await api()
      .put(`/api/v1/candidates/${candidateId}/vetting/score`)
      .set('Cookie', cookie)
      .send({ criterionId: criterionB.id, score: 5 });
    row = await prisma.candidate.findUnique({ where: { id: candidateId } });
    expect(row?.status).toBe('DISQUALIFIED');
    expect(row?.vettingNote).toContain('Auto decision');

    // A revised score above the mark re-evaluates the AUTO decision.
    await api()
      .put(`/api/v1/candidates/${candidateId}/vetting/score`)
      .set('Cookie', cookie)
      .send({ criterionId: criterionA.id, score: 9 });
    row = await prisma.candidate.findUnique({ where: { id: candidateId } });
    expect(row?.status).toBe('QUALIFIED');

    // A manual decision is never overridden by later scores.
    await api()
      .post(`/api/v1/candidates/${candidateId}/status`)
      .set('Cookie', cookie)
      .send({ note: 'Withdrawn by the candidate', status: 'WITHDRAWN' });
    await api()
      .put(`/api/v1/candidates/${candidateId}/vetting/score`)
      .set('Cookie', cookie)
      .send({ criterionId: criterionA.id, score: 10 });
    row = await prisma.candidate.findUnique({ where: { id: candidateId } });
    expect(row?.status).toBe('WITHDRAWN');
  });

  it('enforces the candidate lifecycle map', async () => {
    const cookie = await superAdminCookie();
    const { candidates } = await createElectionFixture();
    const target = candidates[0];

    const withdrawn = await api()
      .post(`/api/v1/candidates/${target.id}/status`)
      .set('Cookie', cookie)
      .send({ status: 'WITHDRAWN' });
    expect(withdrawn.status).toBe(200);

    const revive = await api()
      .post(`/api/v1/candidates/${target.id}/status`)
      .set('Cookie', cookie)
      .send({ status: 'QUALIFIED' });
    expect(revive.status).toBe(400);
    expect(bodyOf<{ code?: string }>(revive).code).toBe(
      'INVALID_CANDIDATE_TRANSITION',
    );
  });

  it('assigns ballot numbers manually and automatically, unique per portfolio', async () => {
    const cookie = await superAdminCookie();
    const { candidates, election } = await createElectionFixture();

    const setOne = await api()
      .patch(`/api/v1/candidates/${candidates[0].id}/ballot-number`)
      .set('Cookie', cookie)
      .send({ ballotNumber: 1 });
    expect(setOne.status).toBe(200);

    const clash = await api()
      .patch(`/api/v1/candidates/${candidates[1].id}/ballot-number`)
      .set('Cookie', cookie)
      .send({ ballotNumber: 1 });
    expect(clash.status).toBe(409);
    expect(bodyOf<{ code?: string }>(clash).code).toBe('BALLOT_NUMBER_TAKEN');

    const auto = await api()
      .post(`/api/v1/elections/${election.id}/ballot-numbers/auto`)
      .set('Cookie', cookie)
      .send({ strategy: 'ALPHABETICAL' });
    expect(auto.status).toBe(200);

    const numbered = await prisma.candidate.findMany({
      orderBy: { ballotNumber: 'asc' },
      select: { ballotNumber: true, name: true },
      where: { electionId: election.id },
    });
    // Alice then Bob, alphabetically.
    expect(numbered.map((c) => `${String(c.ballotNumber)}:${c.name}`)).toEqual([
      '1:Alice',
      '2:Bob',
    ]);

    // Disqualification vacates the number.
    const dq = await api()
      .post(`/api/v1/candidates/${candidates[0].id}/status`)
      .set('Cookie', cookie)
      .send({ note: 'Incomplete documents', status: 'DISQUALIFIED' });
    expect(dq.status).toBe(200);
    const after = await prisma.candidate.findUnique({
      select: { ballotNumber: true, status: true },
      where: { id: candidates[0].id },
    });
    expect(after).toEqual({ ballotNumber: null, status: 'DISQUALIFIED' });
  });
});
