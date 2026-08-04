// test/integration/eligibility-roll.test.ts
//
// Build 5: election-level constituency scoping (EligibilityMode.GROUPS),
// explicit roll management, and the visibility rules in the voter portal.
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

/** Category with two groups (single-select, like a Department dimension). */
const seedGroups = async () => {
  const category = await prisma.groupCategory.create({
    data: { code: `dept-${String(Date.now())}`, name: 'Department' },
  });
  const cs = await prisma.group.create({
    data: {
      categoryId: category.id,
      code: `cs-${String(Date.now())}`,
      name: 'Computer Science',
    },
  });
  const stats = await prisma.group.create({
    data: {
      categoryId: category.id,
      code: `st-${String(Date.now())}`,
      name: 'Statistics',
    },
  });
  return { category, cs, stats };
};

/** An open election scoped to the given groups, with one contested portfolio. */
const createGroupElection = async (groupIds: string[]) => {
  const election = await prisma.election.create({
    data: {
      eligibilityGroups: { create: groupIds.map((groupId) => ({ groupId })) },
      eligibilityMode: 'GROUPS',
      endDate: new Date(Date.now() + 86_400_000),
      name: 'Departmental Election',
      resultsPolicy: 'LIVE',
      slug: `dept-${String(Date.now())}`,
      startDate: new Date(Date.now() - 3600_000),
      status: 'IN_PROGRESS',
    },
  });
  const portfolio = await prisma.portfolio.create({
    data: { electionId: election.id, name: 'Dept President' },
  });
  const candidate = await prisma.candidate.create({
    data: { electionId: election.id, name: 'Kojo', portfolioId: portfolio.id },
  });
  return { candidate, election, portfolio };
};

const addMembership = (voterId: string, groupId: string) =>
  prisma.voterGroupMembership.create({ data: { groupId, voterId } });

describe('group-scoped election visibility and votability', () => {
  beforeEach(resetDb);

  it('is visible and votable only for voters in the scoped groups', async () => {
    const { cs, stats } = await seedGroups();
    const open = await createElectionFixture(); // ALL_VOTERS
    const dept = await createGroupElection([cs.id]);

    const csVoter = await createVoterFixture('CS1', '+233550000031');
    await addMembership(csVoter.voter.id, cs.id);
    const statsVoter = await createVoterFixture('ST1', '+233550000032');
    await addMembership(statsVoter.voter.id, stats.id);

    // The CS voter sees both elections; the Stats voter only the open one.
    const csCookie = await voterLogin('CS1');
    const csList = bodyOf<{ data: { id: string }[] }>(
      await api().get('/api/v1/voter/elections').set('Cookie', csCookie),
    ).data.map((e) => e.id);
    expect(csList).toContain(open.election.id);
    expect(csList).toContain(dept.election.id);

    const statsCookie = await voterLogin('ST1');
    const statsList = bodyOf<{ data: { id: string }[] }>(
      await api().get('/api/v1/voter/elections').set('Cookie', statsCookie),
    ).data.map((e) => e.id);
    expect(statsList).toContain(open.election.id);
    expect(statsList).not.toContain(dept.election.id);

    // Votability follows visibility.
    const csCast = await api()
      .post(`/api/v1/voter/elections/${dept.election.id}/ballot`)
      .set('Cookie', csCookie)
      .send({
        selections: [
          { candidateIds: [dept.candidate.id], portfolioId: dept.portfolio.id },
        ],
      });
    expect(csCast.status).toBe(201);

    const statsBallot = await api()
      .get(`/api/v1/voter/elections/${dept.election.id}/ballot`)
      .set('Cookie', statsCookie);
    expect(statsBallot.status).toBe(403);
    expect(bodyOf<{ code?: string }>(statsBallot).code).toBe('NOT_ELIGIBLE');

    const statsCast = await api()
      .post(`/api/v1/voter/elections/${dept.election.id}/ballot`)
      .set('Cookie', statsCookie)
      .send({
        selections: [
          { candidateIds: [dept.candidate.id], portfolioId: dept.portfolio.id },
        ],
      });
    expect(statsCast.status).toBe(403);
  });

  it('an explicit roll exclusion blocks voting even in an ALL_VOTERS election', async () => {
    const { candidates, election, portfolio } = await createElectionFixture();
    const { voter } = await createVoterFixture('EX1', '+233550000033');
    const adminCookie = await superAdminCookie();

    const exclude = await api()
      .patch(`/api/v1/elections/${election.id}/roll/${voter.id}`)
      .set('Cookie', adminCookie)
      .send({ isEligible: false });
    expect(exclude.status).toBe(200);

    const cookie = await voterLogin('EX1');
    const cast = await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send({
        selections: [{ candidateIds: [candidates[0].id], portfolioId: portfolio.id }],
      });
    expect(cast.status).toBe(403);
    expect(bodyOf<{ code?: string }>(cast).code).toBe('NOT_ELIGIBLE');
  });

  it('requires at least one eligibility group for a GROUPS election', async () => {
    const cookie = await superAdminCookie();
    const { cs } = await seedGroups();

    const missing = await api()
      .post('/api/v1/elections')
      .set('Cookie', cookie)
      .send({
        eligibilityMode: 'GROUPS',
        endDate: new Date(Date.now() + 86_400_000).toISOString(),
        name: 'Scoped without groups',
        startDate: new Date(Date.now() + 3600_000).toISOString(),
      });
    expect(missing.status).toBe(400);
    expect(bodyOf<{ code?: string }>(missing).code).toBe(
      'ELIGIBILITY_GROUPS_REQUIRED',
    );

    const created = await api()
      .post('/api/v1/elections')
      .set('Cookie', cookie)
      .send({
        eligibilityMode: 'GROUPS',
        endDate: new Date(Date.now() + 86_400_000).toISOString(),
        groupIds: [cs.id],
        name: 'CS Departmental',
        startDate: new Date(Date.now() + 3600_000).toISOString(),
      });
    expect(created.status).toBe(201);
    const id = bodyOf<{ data: { id: string } }>(created).data.id;

    const detail = bodyOf<{
      data: { eligibilityGroups: { group: { id: string } }[] };
    }>(await api().get(`/api/v1/elections/${id}`).set('Cookie', cookie));
    expect(detail.data.eligibilityGroups.map((g) => g.group.id)).toEqual([cs.id]);
  });

  it('ROLL elections are visible and votable only for voters on the roll', async () => {
    const adminCookie = await superAdminCookie();
    const election = await prisma.election.create({
      data: {
        eligibilityMode: 'ROLL',
        endDate: new Date(Date.now() + 86_400_000),
        name: 'Roll Election',
        slug: `roll-${String(Date.now())}`,
        startDate: new Date(Date.now() - 3600_000),
        status: 'IN_PROGRESS',
      },
    });
    const portfolio = await prisma.portfolio.create({
      data: { electionId: election.id, name: 'Chair' },
    });
    const candidate = await prisma.candidate.create({
      data: { electionId: election.id, name: 'Adwoa', portfolioId: portfolio.id },
    });
    const onRoll = await createVoterFixture('ROLL1', '+233550000034');
    await createVoterFixture('ROLL2', '+233550000035');

    const add = await api()
      .post(`/api/v1/elections/${election.id}/roll`)
      .set('Cookie', adminCookie)
      .send({ voterIds: [onRoll.voter.id] });
    expect(add.status).toBe(200);
    expect(bodyOf<{ data: { added: number } }>(add).data.added).toBe(1);

    const onCookie = await voterLogin('ROLL1');
    const onList = bodyOf<{ data: { id: string }[] }>(
      await api().get('/api/v1/voter/elections').set('Cookie', onCookie),
    ).data.map((e) => e.id);
    expect(onList).toContain(election.id);

    const cast = await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', onCookie)
      .send({
        selections: [{ candidateIds: [candidate.id], portfolioId: portfolio.id }],
      });
    expect(cast.status).toBe(201);

    const offCookie = await voterLogin('ROLL2');
    const offList = bodyOf<{ data: { id: string }[] }>(
      await api().get('/api/v1/voter/elections').set('Cookie', offCookie),
    ).data.map((e) => e.id);
    expect(offList).not.toContain(election.id);
    const offBallot = await api()
      .get(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', offCookie);
    expect(offBallot.status).toBe(403);
  });
});

describe('roll management', () => {
  beforeEach(resetDb);

  it('adds a whole group, lists with filters, and enforces removal rules', async () => {
    const adminCookie = await superAdminCookie();
    const { cs } = await seedGroups();
    const { candidates, election, portfolio } = await createElectionFixture();

    const a = await createVoterFixture('R1', '+233550000041');
    const b = await createVoterFixture('R2', '+233550000042');
    await addMembership(a.voter.id, cs.id);
    await addMembership(b.voter.id, cs.id);

    // Add by group: both members land on the roll.
    const add = await api()
      .post(`/api/v1/elections/${election.id}/roll`)
      .set('Cookie', adminCookie)
      .send({ groupId: cs.id });
    expect(add.status).toBe(200);
    expect(bodyOf<{ data: { added: number } }>(add).data.added).toBe(2);

    // Re-adding is idempotent.
    const again = await api()
      .post(`/api/v1/elections/${election.id}/roll`)
      .set('Cookie', adminCookie)
      .send({ groupId: cs.id });
    expect(bodyOf<{ data: { added: number; alreadyEligible: number } }>(again).data)
      .toMatchObject({ added: 0, alreadyEligible: 2 });

    // Search narrows by the voter's registration number.
    const list = bodyOf<{ data: { voter: { voterId: string } }[]; meta: { total: number } }>(
      await api()
        .get(`/api/v1/elections/${election.id}/roll?search=R1`)
        .set('Cookie', adminCookie),
    );
    expect(list.meta.total).toBe(1);
    expect(list.data[0].voter.voterId).toBe('R1');

    // A voter with no history can be removed outright.
    const removeClean = await api()
      .delete(`/api/v1/elections/${election.id}/roll/${b.voter.id}`)
      .set('Cookie', adminCookie);
    expect(removeClean.status).toBe(200);

    // Once they have voted, removal is refused; exclusion is the path.
    const cookie = await voterLogin('R1');
    await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send({
        selections: [{ candidateIds: [candidates[0].id], portfolioId: portfolio.id }],
      });
    const removeVoted = await api()
      .delete(`/api/v1/elections/${election.id}/roll/${a.voter.id}`)
      .set('Cookie', adminCookie);
    expect(removeVoted.status).toBe(409);
    expect(bodyOf<{ code?: string }>(removeVoted).code).toBe(
      'ROLL_ENTRY_HAS_HISTORY',
    );

    const exclude = await api()
      .patch(`/api/v1/elections/${election.id}/roll/${a.voter.id}`)
      .set('Cookie', adminCookie)
      .send({ isEligible: false });
    expect(exclude.status).toBe(200);
  });

  it('validates the selection and refuses unknown voters or groups', async () => {
    const adminCookie = await superAdminCookie();
    const { election } = await createElectionFixture();

    const empty = await api()
      .post(`/api/v1/elections/${election.id}/roll`)
      .set('Cookie', adminCookie)
      .send({});
    expect(empty.status).toBe(400);

    const unknownVoter = await api()
      .post(`/api/v1/elections/${election.id}/roll`)
      .set('Cookie', adminCookie)
      .send({ voterIds: ['nope'] });
    expect(unknownVoter.status).toBe(400);
    expect(bodyOf<{ code?: string }>(unknownVoter).code).toBe('UNKNOWN_VOTER');

    const unknownGroup = await api()
      .post(`/api/v1/elections/${election.id}/roll`)
      .set('Cookie', adminCookie)
      .send({ groupId: 'nope' });
    expect(unknownGroup.status).toBe(400);
    expect(bodyOf<{ code?: string }>(unknownGroup).code).toBe('UNKNOWN_GROUP');
  });
});
