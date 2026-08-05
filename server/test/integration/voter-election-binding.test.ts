// test/integration/voter-election-binding.test.ts
//
// Build 7.1: voters are registered INTO elections, candidates get sign-in
// accounts from their contact details, and the roll's bulk-add can enrol
// voters into one of the election's eligibility groups.
import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import {
  api,
  bodyOf,
  createElectionFixture,
  createUser,
  loginCookie,
  postCandidate,
  prisma,
  resetDb,
} from '../helpers.js';

const superAdminCookie = async (): Promise<string> => {
  await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
  return loginCookie('super@test.com');
};

describe('voter-election binding', () => {
  beforeEach(resetDb);

  it('lists only voters outside an election with excludeElectionId', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();
    const inside = await prisma.voter.create({
      data: { name: 'Inside Voter', voterId: 'IN-1' },
    });
    await prisma.voterElection.create({
      data: { electionId: election.id, isEligible: true, voterId: inside.id },
    });
    await prisma.voter.create({ data: { name: 'Outside Voter', voterId: 'OUT-1' } });

    const res = await api()
      .get(`/api/v1/voters?excludeElectionId=${election.id}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const ids = bodyOf<{ data: { voterId: string }[] }>(res).data.map((v) => v.voterId);
    expect(ids).toContain('OUT-1');
    expect(ids).not.toContain('IN-1');
  });

  it('bulk roll add can enrol the voters into an eligibility group', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();
    const category = await prisma.groupCategory.create({
      data: { allowMultiple: false, code: 'dept', name: 'Department' },
    });
    const group = await prisma.group.create({
      data: { categoryId: category.id, code: 'cs', name: 'Computer Science' },
    });
    const stranger = await prisma.group.create({
      data: { categoryId: category.id, code: 'law', name: 'Law' },
    });
    await prisma.electionEligibility.create({
      data: { electionId: election.id, groupId: group.id },
    });
    const voter = await prisma.voter.create({
      data: { name: 'Joiner', voterId: 'JOIN-1' },
    });

    // A group outside the election's scope is refused.
    const bad = await api()
      .post(`/api/v1/elections/${election.id}/roll`)
      .set('Cookie', cookie)
      .send({ joinGroupId: stranger.id, voterIds: [voter.id] });
    expect(bad.status).toBe(400);
    expect(bodyOf<{ code?: string }>(bad).code).toBe('GROUP_NOT_IN_ELECTION');

    const res = await api()
      .post(`/api/v1/elections/${election.id}/roll`)
      .set('Cookie', cookie)
      .send({ joinGroupId: group.id, voterIds: [voter.id] });
    expect(res.status).toBe(200);
    expect(bodyOf<{ data: { added: number; joinedGroup: number } }>(res).data).toMatchObject(
      { added: 1, joinedGroup: 1 },
    );
    const memberships = await prisma.voterGroupMembership.findMany({
      where: { voterId: voter.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].groupId).toBe(group.id);
  });

  it('voter profile includes their elections', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();
    const voter = await prisma.voter.create({
      data: { name: 'Profiled', voterId: 'PROF-1' },
    });
    await prisma.voterElection.create({
      data: { electionId: election.id, isEligible: true, voterId: voter.id },
    });

    const res = await api().get(`/api/v1/voters/${voter.id}`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    const body = bodyOf<{
      data: { voterElections: { election: { id: string; name: string } }[] };
    }>(res);
    expect(body.data.voterElections).toHaveLength(1);
    expect(body.data.voterElections[0].election.id).toBe(election.id);
  });
});

describe('candidate sign-in accounts', () => {
  beforeEach(resetDb);

  it('refuses a nomination without contact, creates an account with one', async () => {
    const cookie = await superAdminCookie();
    const { election, portfolio } = await createElectionFixture();

    const bare = await api()
      .post('/api/v1/candidates')
      .set('Cookie', cookie)
      .send({ electionId: election.id, name: 'No Contact', portfolioId: portfolio.id });
    expect(bare.status).toBe(400);

    const res = await postCandidate(cookie, {
      electionId: election.id,
      email: 'nom.person@test.com',
      name: 'Nominated Person',
      portfolioId: portfolio.id,
    });
    expect(res.status).toBe(201);
    const created = await prisma.candidate.findFirst({
      include: { account: true },
      where: { name: 'Nominated Person' },
    });
    expect(created?.account?.email).toBe('nom.person@test.com');
    expect(created?.account?.role).toBe(Role.CANDIDATE);
    expect(created?.account?.mustChangePassword).toBe(true);
  });

  it('reuses an existing candidate account and rejects non-candidate contacts', async () => {
    const cookie = await superAdminCookie();
    const { election, portfolio } = await createElectionFixture();
    const existing = await prisma.user.create({
      data: {
        email: 'repeat@test.com',
        firstName: 'Repeat',
        lastName: 'Runner',
        role: Role.CANDIDATE,
      },
    });

    const res = await postCandidate(cookie, {
      electionId: election.id,
      email: 'repeat@test.com',
      name: 'Repeat Runner',
      portfolioId: portfolio.id,
    });
    expect(res.status).toBe(201);
    const linked = await prisma.candidate.findFirst({
      where: { name: 'Repeat Runner' },
    });
    expect(linked?.accountId).toBe(existing.id);

    // super@test.com belongs to the SUPER_ADMIN - refuse the hijack.
    const clash = await postCandidate(cookie, {
      electionId: election.id,
      email: 'super@test.com',
      name: 'Sneaky Person',
      portfolioId: portfolio.id,
    });
    expect(clash.status).toBe(409);
  });

  it('a phone-only candidate can sign in with phone + temporary password', async () => {
    const cookie = await superAdminCookie();
    const { election, portfolio } = await createElectionFixture();

    const res = await postCandidate(cookie, {
      electionId: election.id,
      name: 'Phone Person',
      phone: '+233550000091',
      portfolioId: portfolio.id,
    });
    expect(res.status).toBe(201);
    const account = await prisma.user.findFirst({
      where: { phone: '+233550000091' },
    });
    expect(account?.role).toBe(Role.CANDIDATE);
    expect(account?.password).not.toBeNull();
  });
});

describe('contact uniqueness and normalization', () => {
  beforeEach(resetDb);

  it('refuses a second voter with the same email or phone in any format', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();

    const first = await api()
      .post('/api/v1/voters')
      .set('Cookie', cookie)
      .send({
        electionIds: [election.id],
        email: 'Ama@Test.com',
        name: 'Ama One',
        phoneNumber: '+233 24 000 0001',
        voterId: 'UNIQ-1',
      });
    expect(first.status).toBe(201);
    // Stored canonically: lowercase email, E.164 phone.
    const stored = await prisma.voter.findFirst({ where: { voterId: 'UNIQ-1' } });
    expect(stored?.email).toBe('ama@test.com');
    expect(stored?.phoneNumber).toBe('+233240000001');

    // Same email, different casing: refused.
    const dupEmail = await api()
      .post('/api/v1/voters')
      .set('Cookie', cookie)
      .send({
        electionIds: [election.id],
        email: 'AMA@test.com',
        name: 'Ama Two',
        voterId: 'UNIQ-2',
      });
    expect(dupEmail.status).toBe(409);

    // Same phone, different formatting: refused.
    const dupPhone = await api()
      .post('/api/v1/voters')
      .set('Cookie', cookie)
      .send({
        electionIds: [election.id],
        name: 'Ama Three',
        phoneNumber: '024 000 0001',
        voterId: 'UNIQ-3',
      });
    expect(dupPhone.status).toBe(409);
  });

  it('refuses a second candidate using another person\'s contact', async () => {
    const cookie = await superAdminCookie();
    const { election, portfolio } = await createElectionFixture();

    const first = await postCandidate(cookie, {
      electionId: election.id,
      email: 'owner@test.com',
      name: 'Contact Owner',
      portfolioId: portfolio.id,
    });
    expect(first.status).toBe(201);

    // A different person with the same email: refused.
    const stolen = await postCandidate(cookie, {
      electionId: election.id,
      email: 'owner@test.com',
      name: 'Somebody Else',
      portfolioId: portfolio.id,
    });
    expect(stolen.status).toBe(409);

    // The same person nominated twice in the SAME election: refused.
    const twice = await postCandidate(cookie, {
      electionId: election.id,
      email: 'owner@test.com',
      name: 'Contact Owner',
      portfolioId: portfolio.id,
    });
    expect(twice.status).toBe(409);

    // The same person in a DIFFERENT election: allowed, same account reused.
    const { election: other, portfolio: otherPortfolio } = await createElectionFixture();
    const returning = await postCandidate(cookie, {
      electionId: other.id,
      email: 'owner@test.com',
      name: 'Contact Owner',
      portfolioId: otherPortfolio.id,
    });
    expect(returning.status).toBe(201);
    const accounts = await prisma.user.count({ where: { email: 'owner@test.com' } });
    expect(accounts).toBe(1);
  });
});

describe('candidate allocation to another election', () => {
  beforeEach(resetDb);

  it('allocates existing people to a portfolio, skipping those already in', async () => {
    const cookie = await superAdminCookie();
    const source = await createElectionFixture(); // Alice + Bob
    // A clean target (no candidates of its own, so no name collisions).
    const targetElection = await prisma.election.create({
      data: {
        endDate: new Date(Date.now() + 86_400_000),
        name: 'Target Election',
        slug: `target-${Date.now()}`,
        startDate: new Date(Date.now() - 3600_000),
        status: 'IN_PROGRESS',
      },
    });
    const targetPortfolio = await prisma.portfolio.create({
      data: {
        electionId: targetElection.id,
        name: 'Chair',
        votingMethod: 'SINGLE_CHOICE',
      },
    });
    const target = { election: targetElection, portfolio: targetPortfolio };

    // Link Alice to an account so allocation carries her identity over.
    const account = await prisma.user.create({
      data: {
        email: 'alice.alloc@test.com',
        firstName: 'Alice',
        lastName: 'Alloc',
        role: Role.CANDIDATE,
      },
    });
    await prisma.candidate.update({
      data: { accountId: account.id },
      where: { id: source.candidates[0].id },
    });

    // The picker lists people not yet in the target election.
    const pickable = await api()
      .get(`/api/v1/candidates?excludeElectionId=${target.election.id}`)
      .set('Cookie', cookie);
    const ids = bodyOf<{ data: { id: string }[] }>(pickable).data.map((c) => c.id);
    expect(ids).toContain(source.candidates[0].id);

    // A portfolio outside the target election is refused.
    const wrongPortfolio = await api()
      .post(`/api/v1/elections/${target.election.id}/candidates/allocate`)
      .set('Cookie', cookie)
      .send({
        candidateIds: [source.candidates[0].id],
        portfolioId: source.portfolio.id,
      });
    expect(wrongPortfolio.status).toBe(400);

    const res = await api()
      .post(`/api/v1/elections/${target.election.id}/candidates/allocate`)
      .set('Cookie', cookie)
      .send({
        candidateIds: [source.candidates[0].id, source.candidates[1].id],
        portfolioId: target.portfolio.id,
      });
    expect(res.status).toBe(200);
    expect(bodyOf<{ data: { added: number } }>(res).data.added).toBe(2);

    // Alice's new candidacy carries her account (history links up).
    const allocated = await prisma.candidate.findFirst({
      where: { accountId: account.id, electionId: target.election.id },
    });
    expect(allocated).not.toBeNull();

    // Re-allocating the same people adds nothing.
    const again = await api()
      .post(`/api/v1/elections/${target.election.id}/candidates/allocate`)
      .set('Cookie', cookie)
      .send({
        candidateIds: [source.candidates[0].id],
        portfolioId: target.portfolio.id,
      });
    expect(bodyOf<{ data: { added: number; skipped: number } }>(again).data).toMatchObject(
      { added: 0, skipped: 1 },
    );

    // And the picker no longer offers them for this election.
    const after = await api()
      .get(`/api/v1/candidates?excludeElectionId=${target.election.id}`)
      .set('Cookie', cookie);
    const afterIds = bodyOf<{ data: { id: string }[] }>(after).data.map((c) => c.id);
    expect(afterIds).not.toContain(source.candidates[0].id);
  });
});
