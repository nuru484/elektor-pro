// test/integration/election-hardening.test.ts
//
// Hardening around the election domain: certification visibility,
// the certification lock, the status state machine, whole-chain ballot
// verification, single-select category enforcement, and voter email
// uniqueness.
import { beforeEach, describe, expect, it } from 'vitest';

import { ElectionStatus, Role } from '../../generated/prisma/client.js';
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
  const admin = await createUser(Role.SUPER_ADMIN, {
    email: 'super@test.com',
  });
  return loginCookie(admin.email ?? 'super@test.com');
};

const voterLogin = async (identifier: string): Promise<string> => {
  const reqRes = await api().post('/api/v1/voter/otp/request').send({ identifier });
  const code = bodyOf<{ data: { devCode: string } }>(reqRes).data.devCode;
  const verifyRes = await api()
    .post('/api/v1/voter/otp/verify')
    .send({ code, identifier });
  return toCookieHeader(verifyRes.headers['set-cookie']);
};

describe('certification endpoint visibility', () => {
  beforeEach(resetDb);

  it('refuses the snapshot to anonymous viewers when results are not published', async () => {
    const { election } = await createElectionFixture();
    // Defense in depth: a snapshot existing without publication must not leak.
    await prisma.resultSnapshot.create({
      data: { data: {}, electionId: election.id, hash: 'h'.repeat(64) },
    });
    await prisma.election.update({
      data: { resultsPolicy: 'MANUAL' },
      where: { id: election.id },
    });

    const res = await api().get(`/api/v1/elections/${election.id}/certification`);
    expect(res.status).toBe(403);
  });

  it('serves the snapshot publicly once results are certified (published)', async () => {
    const { election } = await createElectionFixture();
    await prisma.election.update({
      data: { status: ElectionStatus.ENDED },
      where: { id: election.id },
    });
    const cookie = await superAdminCookie();
    const certify = await api()
      .post(`/api/v1/elections/${election.id}/results/certify`)
      .set('Cookie', cookie);
    expect(certify.status).toBe(200);

    const res = await api().get(`/api/v1/elections/${election.id}/certification`);
    expect(res.status).toBe(200);
    expect(bodyOf<{ data: { hash: string } }>(res).data.hash).toHaveLength(64);
  });
});

describe('certification lock (Election.isLocked)', () => {
  beforeEach(resetDb);

  const certifiedElection = async (cookie: string) => {
    const fixture = await createElectionFixture();
    await prisma.election.update({
      data: { status: ElectionStatus.ENDED },
      where: { id: fixture.election.id },
    });
    const res = await api()
      .post(`/api/v1/elections/${fixture.election.id}/results/certify`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    return fixture;
  };

  it('blocks election content edits and deletion after certification', async () => {
    const cookie = await superAdminCookie();
    const { election } = await certifiedElection(cookie);

    const patch = await api()
      .patch(`/api/v1/elections/${election.id}`)
      .set('Cookie', cookie)
      .send({ name: 'Renamed after certification' });
    expect(patch.status).toBe(409);
    expect(bodyOf<{ code?: string }>(patch).code).toBe('ELECTION_LOCKED');

    const del = await api()
      .delete(`/api/v1/elections/${election.id}`)
      .set('Cookie', cookie);
    expect(del.status).toBe(409);
  });

  it('blocks portfolio and candidate writes inside a certified election', async () => {
    const cookie = await superAdminCookie();
    const { candidates, election, portfolio } = await certifiedElection(cookie);

    const newPortfolio = await api()
      .post('/api/v1/portfolios')
      .set('Cookie', cookie)
      .send({ electionId: election.id, name: 'Late portfolio' });
    expect(newPortfolio.status).toBe(409);

    const editPortfolio = await api()
      .patch(`/api/v1/portfolios/${portfolio.id}`)
      .set('Cookie', cookie)
      .send({ name: 'Renamed portfolio' });
    expect(editPortfolio.status).toBe(409);

    const editCandidate = await api()
      .patch(`/api/v1/candidates/${candidates[0].id}`)
      .set('Cookie', cookie)
      .send({ name: 'Renamed candidate' });
    expect(editCandidate.status).toBe(409);

    const delCandidate = await api()
      .delete(`/api/v1/candidates/${candidates[0].id}`)
      .set('Cookie', cookie);
    expect(delCandidate.status).toBe(409);
  });

  it('still allows archiving a certified election (status-only change)', async () => {
    const cookie = await superAdminCookie();
    const { election } = await certifiedElection(cookie);

    const archive = await api()
      .patch(`/api/v1/elections/${election.id}/status`)
      .set('Cookie', cookie)
      .send({ status: ElectionStatus.ARCHIVED });
    expect(archive.status).toBe(200);

    const row = await prisma.election.findUnique({ where: { id: election.id } });
    expect(row?.status).toBe(ElectionStatus.ARCHIVED);
  });
});

describe('election status state machine', () => {
  beforeEach(resetDb);

  const draftElection = () =>
    prisma.election.create({
      data: {
        endDate: new Date(Date.now() + 86_400_000),
        name: 'Draft Election',
        slug: `draft-${Date.now()}`,
        startDate: new Date(Date.now() + 3600_000),
        status: ElectionStatus.DRAFT,
      },
    });

  it('rejects an illegal transition with a clear code', async () => {
    const cookie = await superAdminCookie();
    const election = await draftElection();

    const res = await api()
      .patch(`/api/v1/elections/${election.id}/status`)
      .set('Cookie', cookie)
      .send({ status: ElectionStatus.ENDED });
    expect(res.status).toBe(400);
    expect(bodyOf<{ code?: string }>(res).code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('walks a legal lifecycle, enforcing the real calendar at every step', async () => {
    const cookie = await superAdminCookie();
    const election = await draftElection(); // starts in 1h, ends in 24h
    const setStatus = (status: ElectionStatus) =>
      api()
        .patch(`/api/v1/elections/${election.id}/status`)
        .set('Cookie', cookie)
        .send({ status });
    const patch = (body: Record<string, unknown>) =>
      api()
        .patch(`/api/v1/elections/${election.id}`)
        .set('Cookie', cookie)
        .send(body);

    expect((await setStatus(ElectionStatus.SCHEDULED)).status).toBe(200);
    // Re-asserting the current status is a no-op, not an error.
    expect((await setStatus(ElectionStatus.SCHEDULED)).status).toBe(200);

    // The start date is still an hour away: opening is refused until the
    // admin brings the window forward.
    const early = await setStatus(ElectionStatus.IN_PROGRESS);
    expect(early.status).toBe(400);
    expect(bodyOf<{ code?: string }>(early).code).toBe('WINDOW_NOT_STARTED');

    // Dates and status adjusted in ONE submit: judged against the new window.
    const openNow = await patch({
      startDate: new Date(Date.now() - 60_000).toISOString(),
      status: ElectionStatus.IN_PROGRESS,
    });
    expect(openNow.status).toBe(200);

    expect((await setStatus(ElectionStatus.PAUSED)).status).toBe(200);
    expect((await setStatus(ElectionStatus.IN_PROGRESS)).status).toBe(200);

    // The window is still open: ending early requires closing the window.
    const earlyEnd = await setStatus(ElectionStatus.ENDED);
    expect(earlyEnd.status).toBe(400);
    expect(bodyOf<{ code?: string }>(earlyEnd).code).toBe('WINDOW_STILL_OPEN');
    const endNow = await patch({
      endDate: new Date(Date.now() - 1000).toISOString(),
      status: ElectionStatus.ENDED,
    });
    expect(endNow.status).toBe(200);

    expect((await setStatus(ElectionStatus.DRAFT)).status).toBe(400);
    expect((await setStatus(ElectionStatus.ARCHIVED)).status).toBe(200);
  });
});

describe('ballot chain verification', () => {
  beforeEach(resetDb);

  it('verifies an intact chain across multiple ballots', async () => {
    const { candidates, election, portfolio } = await createElectionFixture();
    await createVoterFixture('CHAIN1', '+233550000021');
    await createVoterFixture('CHAIN2', '+233550000022');
    for (const [i, voter] of ['CHAIN1', 'CHAIN2'].entries()) {
      const cookie = await voterLogin(voter);
      await api()
        .post(`/api/v1/voter/elections/${election.id}/ballot`)
        .set('Cookie', cookie)
        .send({
          selections: [
            { candidateIds: [candidates[i % 2].id], portfolioId: portfolio.id },
          ],
        });
    }

    const res = await api().get(
      `/api/v1/elections/${election.id}/ballots/verify`,
    );
    expect(res.status).toBe(200);
    const body = bodyOf<{ data: { total: number; valid: boolean } }>(res);
    expect(body.data.valid).toBe(true);
    expect(body.data.total).toBe(2);
  });

  it('detects a tampered ballot and reports where the chain broke', async () => {
    const { candidates, election, portfolio } = await createElectionFixture();
    await createVoterFixture('CHAIN3', '+233550000023');
    const cookie = await voterLogin('CHAIN3');
    await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send({
        selections: [{ candidateIds: [candidates[0].id], portfolioId: portfolio.id }],
      });

    // Flip the recorded choice behind the chain's back.
    await prisma.ballotEntry.updateMany({
      data: { candidateId: candidates[1].id },
      where: { ballot: { electionId: election.id } },
    });

    const res = await api().get(
      `/api/v1/elections/${election.id}/ballots/verify`,
    );
    expect(res.status).toBe(200);
    const body = bodyOf<{ data: { brokenAt?: number; valid: boolean } }>(res);
    expect(body.data.valid).toBe(false);
    expect(body.data.brokenAt).toBe(1);
  });

  it('reports an empty chain as valid and unknown elections as 404', async () => {
    const { election } = await createElectionFixture();
    const empty = await api().get(
      `/api/v1/elections/${election.id}/ballots/verify`,
    );
    expect(bodyOf<{ data: { total: number; valid: boolean } }>(empty).data).toEqual({
      electionId: election.id,
      total: 0,
      valid: true,
    });

    const missing = await api().get('/api/v1/elections/nope/ballots/verify');
    expect(missing.status).toBe(404);
  });
});

describe('voter group + identity constraints', () => {
  beforeEach(resetDb);

  const seedCategory = async (allowMultiple: boolean) => {
    const category = await prisma.groupCategory.create({
      data: { allowMultiple, code: `dept-${Date.now()}`, name: 'Department' },
    });
    const groupA = await prisma.group.create({
      data: { categoryId: category.id, code: `cs-${Date.now()}`, name: 'Computer Science' },
    });
    const groupB = await prisma.group.create({
      data: { categoryId: category.id, code: `st-${Date.now()}`, name: 'Statistics' },
    });
    return { category, groupA, groupB };
  };

  it('rejects two groups from a single-select category', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();
    const { groupA, groupB } = await seedCategory(false);

    const res = await api()
      .post('/api/v1/voters')
      .set('Cookie', cookie)
      .send({
        electionIds: [election.id],
        groupIds: [groupA.id, groupB.id],
        name: 'Ama',
        voterId: 'V-1',
      });
    expect(res.status).toBe(400);
    expect(bodyOf<{ code?: string }>(res).code).toBe('SINGLE_GROUP_CATEGORY');
  });

  it('allows multiple groups when the category permits it, and unknown groups fail', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();
    const { groupA, groupB } = await seedCategory(true);

    const ok = await api()
      .post('/api/v1/voters')
      .set('Cookie', cookie)
      .send({
        electionIds: [election.id],
        groupIds: [groupA.id, groupB.id],
        name: 'Kofi',
        voterId: 'V-2',
      });
    expect(ok.status).toBe(201);

    const unknown = await api()
      .post('/api/v1/voters')
      .set('Cookie', cookie)
      .send({
        electionIds: [election.id],
        groupIds: ['not-a-group'],
        name: 'Esi',
        voterId: 'V-3',
      });
    expect(unknown.status).toBe(400);
    expect(bodyOf<{ code?: string }>(unknown).code).toBe('UNKNOWN_GROUP');
  });

  it('enforces voter email uniqueness and requires an election', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();

    // Registration without an election is refused outright.
    const noElection = await api()
      .post('/api/v1/voters')
      .set('Cookie', cookie)
      .send({ email: 'shared@test.com', name: 'Yaw', voterId: 'V-4' });
    expect(noElection.status).toBe(400);

    const first = await api()
      .post('/api/v1/voters')
      .set('Cookie', cookie)
      .send({
        electionIds: [election.id],
        email: 'shared@test.com',
        name: 'Yaw',
        voterId: 'V-4',
      });
    expect(first.status).toBe(201);
    // Registration lands on the election's roll as eligible.
    const created = await prisma.voter.findFirst({
      include: { voterElections: true },
      where: { voterId: 'V-4' },
    });
    expect(created?.voterElections).toHaveLength(1);
    expect(created?.voterElections[0].electionId).toBe(election.id);
    expect(created?.voterElections[0].isEligible).toBe(true);

    const dup = await api()
      .post('/api/v1/voters')
      .set('Cookie', cookie)
      .send({
        electionIds: [election.id],
        email: 'shared@test.com',
        name: 'Abena',
        voterId: 'V-5',
      });
    expect(dup.status).toBe(409);
  });
});
