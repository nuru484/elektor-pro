// test/integration/results-policy.test.ts
//
// Results visibility follows the election's policy exactly: a
// MANUAL election stays hidden after it ends until someone publishes, and
// unpublish takes it back down; certify locks and snapshots; the candidate
// console endpoint returns only the caller's own candidacies.
import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { hashPassword } from '../../src/utils/password.js';
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

describe('results policy gating', () => {
  beforeEach(resetDb);

  it('MANUAL results stay hidden after close until published; unpublish re-hides', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();
    await prisma.election.update({
      data: { resultsPolicy: 'MANUAL', status: 'ENDED' },
      where: { id: election.id },
    });

    // Anonymous and ordinary voters see nothing, even though it ended.
    expect((await api().get(`/api/v1/elections/${election.slug}/results`)).status).toBe(403);
    await createVoterFixture('POL1', '+233550000101');
    const voterCookie = await voterLogin('POL1');
    expect(
      (
        await api()
          .get(`/api/v1/elections/${election.slug}/results`)
          .set('Cookie', voterCookie)
      ).status,
    ).toBe(403);

    // Publish opens it to everyone.
    const publish = await api()
      .post(`/api/v1/elections/${election.id}/results/publish`)
      .set('Cookie', cookie);
    expect(publish.status).toBe(200);
    expect((await api().get(`/api/v1/elections/${election.slug}/results`)).status).toBe(200);

    // Unpublish hides it again.
    const unpublish = await api()
      .post(`/api/v1/elections/${election.id}/results/unpublish`)
      .set('Cookie', cookie);
    expect(unpublish.status).toBe(200);
    expect((await api().get(`/api/v1/elections/${election.slug}/results`)).status).toBe(403);
  });

  it('ON_CLOSE opens at close; LIVE is visible to signed-in viewers during voting', async () => {
    const { election } = await createElectionFixture(); // LIVE, IN_PROGRESS
    await createVoterFixture('POL2', '+233550000102');
    const voterCookie = await voterLogin('POL2');

    // LIVE mid-election: visible to the voter, hidden from anonymous.
    expect(
      (
        await api()
          .get(`/api/v1/elections/${election.slug}/results`)
          .set('Cookie', voterCookie)
      ).status,
    ).toBe(200);
    expect((await api().get(`/api/v1/elections/${election.slug}/results`)).status).toBe(403);

    // ON_CLOSE mid-election: hidden from the voter until it ends.
    await prisma.election.update({
      data: { resultsPolicy: 'ON_CLOSE' },
      where: { id: election.id },
    });
    expect(
      (
        await api()
          .get(`/api/v1/elections/${election.slug}/results`)
          .set('Cookie', voterCookie)
      ).status,
    ).toBe(403);
    await prisma.election.update({
      data: { status: 'ENDED' },
      where: { id: election.id },
    });
    expect(
      (
        await api()
          .get(`/api/v1/elections/${election.slug}/results`)
          .set('Cookie', voterCookie)
      ).status,
    ).toBe(200);
  });

  it('certify snapshots, locks, publishes, and refuses unpublish afterwards', async () => {
    const cookie = await superAdminCookie();
    const { election } = await createElectionFixture();
    await prisma.election.update({
      data: { resultsPolicy: 'MANUAL', status: 'ENDED' },
      where: { id: election.id },
    });

    const certify = await api()
      .post(`/api/v1/elections/${election.id}/results/certify`)
      .set('Cookie', cookie);
    expect(certify.status).toBe(200);
    const { hash, snapshotId } = bodyOf<{ data: { hash: string; snapshotId: string } }>(
      certify,
    ).data;
    expect(hash).toHaveLength(64);
    expect(snapshotId).toBeTruthy();

    const row = await prisma.election.findUnique({ where: { id: election.id } });
    expect(row?.isLocked).toBe(true);
    expect(row?.resultsPublishedAt).not.toBeNull();

    // Certified results are the public record: no taking them down.
    const unpublish = await api()
      .post(`/api/v1/elections/${election.id}/results/unpublish`)
      .set('Cookie', cookie);
    expect(unpublish.status).toBe(400);

    // The certification snapshot is publicly retrievable once published.
    const cert = await api().get(`/api/v1/elections/${election.slug}/certification`);
    expect(cert.status).toBe(200);
    expect(bodyOf<{ data: { hash: string } }>(cert).data.hash).toBe(hash);
  });

  it('receipt verification works by slug', async () => {
    const { election } = await createElectionFixture();
    const missing = await api().get(
      `/api/v1/elections/${election.slug}/receipts/NOPE-0000`,
    );
    expect(missing.status).toBe(404);
  });

  it('my candidacies returns only the caller\'s own', async () => {
    const { candidates } = await createElectionFixture();
    const account = await prisma.user.create({
      data: {
        email: 'mine@test.com',
        firstName: 'Mine',
        lastName: 'Only',
        mustChangePassword: false,
        password: await hashPassword('mine-pass-1'),
        role: Role.CANDIDATE,
      },
    });
    await prisma.candidate.update({
      data: { accountId: account.id },
      where: { id: candidates[0].id },
    });

    const login = await api()
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'mine@test.com', password: 'mine-pass-1' });
    const cookie = toCookieHeader(login.headers['set-cookie']);

    const res = await api().get('/api/v1/my/candidacies').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const list = bodyOf<{ data: { id: string; portfolio: { name: string } }[] }>(res).data;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(candidates[0].id);
  });
});
