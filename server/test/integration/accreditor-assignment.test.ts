// test/integration/accreditor-assignment.test.ts
//
// Per-election accreditation scope: holding ACCREDIT_VOTERS lets someone run
// a desk, but only for the elections an admin has assigned them to. These
// tests are about the boundary - an unassigned election must be unreachable,
// not merely unlisted.
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
} from '../helpers.js';

const superAdminCookie = async (): Promise<string> => {
  await createUser(Role.SUPER_ADMIN, { email: 'super@test.com' });
  return loginCookie('super@test.com');
};

const accreditorCookie = async (): Promise<{ cookie: string; id: string }> => {
  const user = await createUser(Role.ACCREDITOR, { email: 'desk@test.com' });
  return { cookie: await loginCookie('desk@test.com'), id: user.id };
};

describe('accreditor assignments', () => {
  beforeEach(resetDb);

  it('refuses the desk search for an election the accreditor is not on', async () => {
    const { cookie } = await accreditorCookie();
    const { election } = await createElectionFixture();

    const res = await api()
      .get(`/api/v1/elections/${election.id}/accreditation/search`)
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
  });

  it('refuses to accredit a voter for an unassigned election', async () => {
    const { cookie } = await accreditorCookie();
    const { election } = await createElectionFixture();
    const { voter } = await createVoterFixture('SCOPE1', '+233550000801');
    await prisma.voterElection.create({
      data: { electionId: election.id, isEligible: true, voterId: voter.id },
    });

    const res = await api()
      .post(`/api/v1/elections/${election.id}/voters/${voter.id}/accredit`)
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
    // And the refusal is real: nothing was written.
    const link = await prisma.voterElection.findFirst({
      where: { electionId: election.id, voterId: voter.id },
    });
    expect(link?.accreditedAt).toBeNull();
  });

  it('allows the desk once an admin assigns the accreditor', async () => {
    const adminCookie = await superAdminCookie();
    const { cookie, id: accreditorId } = await accreditorCookie();
    const { election } = await createElectionFixture();

    const assign = await api()
      .post('/api/v1/accreditors')
      .send({ electionId: election.id, userId: accreditorId })
      .set('Cookie', adminCookie);
    expect(assign.status).toBe(201);

    const res = await api()
      .get(`/api/v1/elections/${election.id}/accreditation/search`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('shows the accreditor only their own current desk', async () => {
    const adminCookie = await superAdminCookie();
    const { cookie, id: accreditorId } = await accreditorCookie();
    const { election } = await createElectionFixture();
    // A second election the accreditor is deliberately NOT put on.
    await createElectionFixture();

    await api()
      .post('/api/v1/accreditors')
      .send({ electionId: election.id, userId: accreditorId })
      .set('Cookie', adminCookie);

    const mine = await api()
      .get('/api/v1/my-accreditation-elections')
      .set('Cookie', cookie);
    expect(mine.status).toBe(200);
    const desk = bodyOf<{
      data: { current: null | { id: string }; history: { id: string }[] };
    }>(mine).data;
    expect(desk.current?.id).toBe(election.id);
    expect(desk.history).toEqual([]);
  });

  it('refuses a second live posting while one is still running', async () => {
    const adminCookie = await superAdminCookie();
    const { id: accreditorId } = await accreditorCookie();
    const { election } = await createElectionFixture();
    const other = await createElectionFixture();

    await api()
      .post('/api/v1/accreditors')
      .send({ electionId: election.id, userId: accreditorId })
      .set('Cookie', adminCookie);

    const second = await api()
      .post('/api/v1/accreditors')
      .send({ electionId: other.election.id, userId: accreditorId })
      .set('Cookie', adminCookie);

    expect(second.status).toBe(409);
  });

  it('a finished election frees the accreditor and becomes history', async () => {
    const adminCookie = await superAdminCookie();
    const { cookie, id: accreditorId } = await accreditorCookie();
    const { election } = await createElectionFixture();
    const other = await createElectionFixture();

    await api()
      .post('/api/v1/accreditors')
      .send({ electionId: election.id, userId: accreditorId })
      .set('Cookie', adminCookie);
    await prisma.election.update({
      data: { status: 'ENDED' },
      where: { id: election.id },
    });

    // The old posting no longer blocks a new one...
    const second = await api()
      .post('/api/v1/accreditors')
      .send({ electionId: other.election.id, userId: accreditorId })
      .set('Cookie', adminCookie);
    expect(second.status).toBe(201);

    // ...and has moved into history, with the new one current.
    const mine = await api()
      .get('/api/v1/my-accreditation-elections')
      .set('Cookie', cookie);
    const desk = bodyOf<{
      data: { current: null | { id: string }; history: { id: string }[] };
    }>(mine).data;
    expect(desk.current?.id).toBe(other.election.id);
    expect(desk.history.map((row) => row.id)).toEqual([election.id]);
  });

  it('rejects assigning a user who is not an accreditor', async () => {
    const adminCookie = await superAdminCookie();
    const agent = await createUser(Role.AGENT, { email: 'agent@test.com' });
    const { election } = await createElectionFixture();

    const res = await api()
      .post('/api/v1/accreditors')
      .send({ electionId: election.id, userId: agent.id })
      .set('Cookie', adminCookie);

    expect(res.status).toBe(400);
  });

  it('removing the assignment closes the desk again', async () => {
    const adminCookie = await superAdminCookie();
    const { cookie, id: accreditorId } = await accreditorCookie();
    const { election } = await createElectionFixture();

    const assign = await api()
      .post('/api/v1/accreditors')
      .send({ electionId: election.id, userId: accreditorId })
      .set('Cookie', adminCookie);
    const { id } = bodyOf<{ data: { id: string } }>(assign).data;

    await api().delete(`/api/v1/accreditors/${id}`).set('Cookie', adminCookie);

    const res = await api()
      .get(`/api/v1/elections/${election.id}/accreditation/search`)
      .set('Cookie', cookie);
    expect(res.status).toBe(403);
  });
});
