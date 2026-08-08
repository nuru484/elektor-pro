// test/integration/security-hardening.test.ts
//
// Regression cover for the integrity and authorization defects found in the
// production-readiness review. Each spec below reproduces the ORIGINAL
// exploit as closely as the API allows, so a future refactor that reopens one
// fails here rather than in an election.
import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { appendAudit } from '../../src/services/audit/audit.service.js';
import { computeResults } from '../../src/services/results/results.service.js';
import {
  _resetChainCacheForTests,
  castBallot,
  verifyBallotChain,
} from '../../src/services/voting/voting.service.js';
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

const voterLogin = async (identifier: string): Promise<string> => {
  const requested = await api()
    .post('/api/v1/voter/otp/request')
    .send({ identifier });
  const code = bodyOf<{ data: { devCode: string } }>(requested).data.devCode;
  const verified = await api()
    .post('/api/v1/voter/otp/verify')
    .send({ code, identifier });
  return toCookieHeader(verified.headers['set-cookie']);
};

describe('ballot integrity', () => {
  beforeEach(resetDb);

  it('refuses a ballot that names the same portfolio twice', async () => {
    // The original bug: the guard compared the SIZE of the portfolio-id SET
    // against the eligible count, so listing one portfolio twice slipped
    // through and each entry was normalised independently. One voter could
    // record a vote for every candidate in a single-choice race.
    const { candidates, election, portfolio } = await createElectionFixture();
    await createVoterFixture('DUP1', '+233550000201');
    const cookie = await voterLogin('DUP1');

    const res = await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send({
        selections: [
          { candidateIds: [candidates[0].id], portfolioId: portfolio.id },
          { candidateIds: [candidates[1].id], portfolioId: portfolio.id },
        ],
      });

    expect(res.status).toBe(400);
    expect(await prisma.ballot.count({ where: { electionId: election.id } })).toBe(0);
    expect(await prisma.ballotEntry.count()).toBe(0);
    // And the voter is NOT burned: a rejected ballot leaves them able to vote.
    const entry = await prisma.voterElection.findFirst({
      where: { electionId: election.id },
    });
    expect(entry?.hasVoted ?? false).toBe(false);
  });

  it('counts exactly one vote per portfolio for a valid ballot', async () => {
    const { candidates, election, portfolio } = await createElectionFixture();
    await createVoterFixture('DUP2', '+233550000202');
    const cookie = await voterLogin('DUP2');

    await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send({
        selections: [{ candidateIds: [candidates[0].id], portfolioId: portfolio.id }],
      })
      .expect(201);

    const tally = await computeResults(election.id);
    // Votes cast must never exceed voters who voted.
    expect(tally.portfolios[0].totalVotes).toBe(1);
    expect(tally.turnout.totalVoted).toBe(1);
  });

  it('keeps no link from a voter to their ballot', async () => {
    const { candidates, election, portfolio } = await createElectionFixture();
    const { voter } = await createVoterFixture('SECRET1', '+233550000203');
    const cookie = await voterLogin('SECRET1');

    const cast = await api()
      .post(`/api/v1/voter/elections/${election.id}/ballot`)
      .set('Cookie', cookie)
      .send({
        selections: [{ candidateIds: [candidates[0].id], portfolioId: portfolio.id }],
      });
    const receipt = bodyOf<{ data: { receiptCode: string } }>(cast).data.receiptCode;

    // Nothing on the voter's row - in ANY column - can be joined to the
    // ballot. This is the whole secret-ballot guarantee, so it is asserted
    // over the entire row rather than one named field.
    const entry = await prisma.voterElection.findUniqueOrThrow({
      where: { voterId_electionId: { electionId: election.id, voterId: voter.id } },
    });
    expect(entry.hasVoted).toBe(true);
    expect(JSON.stringify(entry)).not.toContain(receipt);

    const ballot = await prisma.ballot.findUniqueOrThrow({ where: { receiptCode: receipt } });
    expect(JSON.stringify(ballot)).not.toContain(voter.id);
  });
});

describe('open ballot option', () => {
  beforeEach(resetDb);

  const castIn = async (electionId: string, voterTag: string, phone: string) => {
    await createVoterFixture(voterTag, phone);
    const cookie = await voterLogin(voterTag);
    const ballot = await api()
      .get(`/api/v1/voter/elections/${electionId}/ballot`)
      .set('Cookie', cookie);
    const view = bodyOf<{
      data: { portfolios: { candidates: { id: string }[]; id: string }[]; voteVisibleToVoter: boolean };
    }>(ballot).data;
    const cast = await api()
      .post(`/api/v1/voter/elections/${electionId}/ballot`)
      .set('Cookie', cookie)
      .send({
        selections: view.portfolios.map((p) => ({
          candidateIds: [p.candidates[0].id],
          portfolioId: p.id,
        })),
      });
    expect(cast.status).toBe(201);
    return { cookie, told: view.voteVisibleToVoter };
  };

  it('replays choices for an open ballot, and says so before the vote', async () => {
    const { election } = await createElectionFixture();
    await prisma.election.update({
      data: { voteVisibleToVoter: true },
      where: { id: election.id },
    });

    const { cookie, told } = await castIn(election.id, 'OPEN1', '+233550000401');
    // The voter was told, on the ballot, that this is not secret.
    expect(told).toBe(true);

    const history = await api().get('/api/v1/voter/history').set('Cookie', cookie);
    const row = bodyOf<{
      data: { choices: null | { candidate: null | { name: string } }[]; receiptCode: null | string }[];
    }>(history).data[0];
    expect(row.receiptCode).toBeTruthy();
    expect(row.choices?.[0].candidate?.name).toBe('Alice');
  });

  it('keeps a secret ballot secret, and says so before the vote', async () => {
    const { election } = await createElectionFixture();
    const { cookie, told } = await castIn(election.id, 'SECRET2', '+233550000402');
    expect(told).toBe(false);

    const history = await api().get('/api/v1/voter/history').set('Cookie', cookie);
    const row = bodyOf<{
      data: { choices: null | unknown[]; receiptCode: null | string }[];
    }>(history).data[0];
    expect(row.choices).toBeNull();
    expect(row.receiptCode).toBeNull();
    expect(
      await prisma.voterElection.count({
        where: { electionId: election.id, receiptCode: { not: null } },
      }),
    ).toBe(0);
  });

  it('purges the stored links when an admin turns the open ballot off', async () => {
    // Switching back to secret must REMOVE the link, not merely stop showing
    // it - otherwise past votes stay attributable while the election claims
    // secrecy, which is the worst of both.
    const { election } = await createElectionFixture();
    await prisma.election.update({
      data: { voteVisibleToVoter: true },
      where: { id: election.id },
    });
    await castIn(election.id, 'PURGE1', '+233550000403');
    expect(
      await prisma.voterElection.count({
        where: { electionId: election.id, receiptCode: { not: null } },
      }),
    ).toBe(1);

    await createUser(Role.SUPER_ADMIN, {
      email: 'purger@test.com',
      password: 'Password123!',
    });
    const admin = await loginCookie('purger@test.com', 'Password123!');
    await api()
      .patch(`/api/v1/elections/${election.id}`)
      .set('Cookie', admin)
      .send({ voteVisibleToVoter: false })
      .expect(200);

    expect(
      await prisma.voterElection.count({
        where: { electionId: election.id, receiptCode: { not: null } },
      }),
    ).toBe(0);
  });
});

describe('concurrent casting', () => {
  beforeEach(resetDb);

  it('records every ballot under a rush, and keeps the chain intact', async () => {
    // The ballot chain is serialised per election by an advisory lock, so
    // during a rush most casts are queued behind it. Prisma's default 2s
    // maxWait then REJECTED the queued ones: measured at 300 concurrent
    // voters, 142 were turned away with "Unable to start a transaction in the
    // given time". No double vote, no broken chain - just voters told their
    // ballot failed, which on election day is disenfranchisement.
    //
    // The invariants asserted here are the ones an election cannot bend:
    // every vote recorded, exactly one ballot each, chain verifiable.
    const VOTERS = 120;
    const { candidates, election, portfolio } = await createElectionFixture();

    const userIds = await Promise.all(
      Array.from({ length: VOTERS }, async (_, i) => {
        const user = await prisma.user.create({
          data: { firstName: 'Rush', lastName: String(i), role: Role.VOTER },
          select: { id: true },
        });
        await prisma.voter.create({
          data: { name: `Rush ${String(i)}`, userId: user.id, voterId: `RUSH-${String(i)}` },
        });
        return user.id;
      }),
    );

    const outcomes = await Promise.allSettled(
      userIds.map((userId) =>
        castBallot(userId, election.id, [
          { candidateIds: [candidates[0].id], portfolioId: portfolio.id },
        ]),
      ),
    );

    const rejected = outcomes.filter((o) => o.status === 'rejected');
    expect(
      rejected.map((o) => (o.reason as Error).message),
      'no voter may be turned away',
    ).toEqual([]);

    expect(await prisma.ballot.count({ where: { electionId: election.id } })).toBe(VOTERS);
    expect(
      await prisma.voterElection.count({
        where: { electionId: election.id, hasVoted: true },
      }),
    ).toBe(VOTERS);
    // Receipts are unique, so no two voters were handed the same ballot.
    const receipts = outcomes.flatMap((o) =>
      o.status === 'fulfilled' ? [(o.value).receiptCode] : [],
    );
    expect(new Set(receipts).size).toBe(VOTERS);

    _resetChainCacheForTests();
    const chain = await verifyBallotChain(election.id);
    expect(chain.valid).toBe(true);
    expect(chain.total).toBe(VOTERS);
  }, 180_000);
});

describe('domain read authorization', () => {
  beforeEach(resetDb);

  it('refuses the voter register to a signed-in voter', async () => {
    // The original bug: catalog reads sat on bare authenticateJWT, so any
    // account - including a voter who had just logged in by SMS - could page
    // the register, complete with phone numbers and per-election hasVoted.
    await createElectionFixture();
    await createVoterFixture('REG1', '+233550000211');
    await createVoterFixture('REG2', '+233550000212');
    const cookie = await voterLogin('REG1');

    for (const path of ['/api/v1/voters', '/api/v1/candidates', '/api/v1/elections']) {
      const res = await api().get(path).set('Cookie', cookie);
      expect(res.status, `${path} must not be readable by a voter`).toBe(403);
    }
  });

  it('still lets an accreditor read the register and the election list', async () => {
    // The desk needs both to do its job; the fix must not lock it out.
    await createElectionFixture();
    await createVoterFixture('REG3', '+233550000213');
    await createUser(Role.ACCREDITOR, {
      email: 'desk@test.com',
      password: 'Password123!',
    });
    const cookie = await loginCookie('desk@test.com', 'Password123!');

    await api().get('/api/v1/voters').set('Cookie', cookie).expect(200);
    await api().get('/api/v1/elections').set('Cookie', cookie).expect(200);
  });

  it('refuses the register to a candidate account', async () => {
    await createVoterFixture('REG4', '+233550000214');
    await createUser(Role.CANDIDATE, {
      email: 'hopeful@test.com',
      password: 'Password123!',
    });
    const cookie = await loginCookie('hopeful@test.com', 'Password123!');

    await api().get('/api/v1/voters').set('Cookie', cookie).expect(403);
  });
});

describe('audit chain', () => {
  beforeEach(resetDb);

  it('stays verifiable when appends race each other', async () => {
    // The original bug: every append read the last hash and wrote without a
    // lock, so concurrent writers all claimed the same prevHash. On election
    // day (simultaneous accreditations) the log reported itself broken with
    // nothing actually wrong.
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        appendAudit(prisma, { action: `race.${String(i)}`, entity: 'Test' }),
      ),
    );

    const rows = await prisma.auditLog.findMany({
      orderBy: { sequence: 'asc' },
      select: { prevHash: true },
    });
    expect(rows).toHaveLength(8);
    // Every row must claim a DIFFERENT predecessor - one shared prevHash is
    // exactly the corruption this guards against.
    expect(new Set(rows.map((r) => r.prevHash)).size).toBe(8);

    const superAdmin = await createUser(Role.SUPER_ADMIN, {
      email: 'sa-audit@test.com',
      password: 'Password123!',
    });
    expect(superAdmin.role).toBe(Role.SUPER_ADMIN);
    const cookie = await loginCookie('sa-audit@test.com', 'Password123!');
    const res = await api().get('/api/v1/audit-logs/verify').set('Cookie', cookie);
    expect(bodyOf<{ data: { valid: boolean } }>(res).data.valid).toBe(true);
  });

  it('detects an entry whose content was rewritten in place', async () => {
    // The original bug: verification only checked that prevHash matched the
    // previous row's hash. Rewriting what an entry SAID left the links intact,
    // so the log passed its own integrity check.
    await appendAudit(prisma, {
      action: 'results.certified',
      entity: 'Election',
      entityId: 'e1',
    });
    const entry = await prisma.auditLog.findFirstOrThrow();
    await prisma.auditLog.update({
      data: { action: 'nothing.happened', metadata: { tampered: true } },
      where: { id: entry.id },
    });

    await createUser(Role.SUPER_ADMIN, {
      email: 'sa-tamper@test.com',
      password: 'Password123!',
    });
    const cookie = await loginCookie('sa-tamper@test.com', 'Password123!');
    const res = await api().get('/api/v1/audit-logs/verify').set('Cookie', cookie);
    const data = bodyOf<{
      data: { brokenAt?: number; reason?: string; valid: boolean };
    }>(res).data;

    expect(data.valid).toBe(false);
    expect(data.reason).toBe('content');
    expect(data.brokenAt).toBe(entry.sequence);
  });
});

describe('results', () => {
  beforeEach(resetDb);

  it('declares no winner when the top score is tied', async () => {
    // The original bug: `winner: ranked[0]` handed a tied seat to whichever
    // candidate happened to sort first, with nothing marking it as tied.
    const { candidates, election, portfolio } = await createElectionFixture();
    for (const [index, candidate] of candidates.entries()) {
      await createVoterFixture(`TIE${String(index)}`, `+23355000030${String(index)}`);
      const cookie = await voterLogin(`TIE${String(index)}`);
      await api()
        .post(`/api/v1/voter/elections/${election.id}/ballot`)
        .set('Cookie', cookie)
        .send({ selections: [{ candidateIds: [candidate.id], portfolioId: portfolio.id }] })
        .expect(201);
    }

    const tally = await computeResults(election.id);
    const race = tally.portfolios[0];
    expect(race.totalVotes).toBe(2);
    expect(race.winner).toBeNull();
    expect(race.isTied).toBe(true);
    expect(race.tiedCandidates.map((c) => c.name).sort()).toEqual(['Alice', 'Bob']);
  });
});

describe('bulk import does not run expensive work inside the transaction', () => {
  beforeEach(resetDb);

  it('imports well past the old transaction-timeout breaking point', async () => {
    // Two separate defects made this fail, both of them putting work that
    // does not need the database on the transaction's critical path:
    //   - credential email/SMS sent inline (~3s each against a real relay);
    //     two nominations were enough to exhaust the 5s budget.
    //   - bcrypt run per account inside the transaction; twenty nominations
    //     exhausted it on hashing alone, and the import schema allows 1000.
    // Both surfaced as a Prisma transaction error that named neither cause.
    // 30 is comfortably past the measured breaking point of 20.
    const COUNT = 30;
    const { election, portfolio } = await createElectionFixture();
    await createUser(Role.SUPER_ADMIN, {
      email: 'importer@test.com',
      password: 'Password123!',
    });
    const cookie = await loginCookie('importer@test.com', 'Password123!');

    const res = await api()
      .post('/api/v1/candidates/bulk')
      .set('Cookie', cookie)
      .send({
        candidates: Array.from({ length: COUNT }, (_, i) => ({
          electionId: election.id,
          email: `bulk${String(i)}@test.com`,
          name: `Bulk Candidate ${String(i)}`,
          portfolioId: portfolio.id,
        })),
      });

    expect(res.status).toBe(201);
    expect(
      await prisma.candidate.count({
        where: { electionId: election.id, name: { startsWith: 'Bulk Candidate' } },
      }),
    ).toBe(COUNT);
    // Every nomination minted a usable login account, each with its own hash.
    const accounts = await prisma.user.findMany({
      select: { password: true },
      where: { email: { startsWith: 'bulk' }, role: Role.CANDIDATE },
    });
    expect(accounts).toHaveLength(COUNT);
    expect(new Set(accounts.map((a) => a.password)).size).toBe(COUNT);
    expect(accounts.every((a) => a.password?.startsWith('$2'))).toBe(true);
  }, 120_000);
});

describe('maker-checker', () => {
  beforeEach(resetDb);

  it('refuses to let a requester approve their own change request', async () => {
    // The original bug: approval checked only that the actor HELD
    // APPROVE_CHANGES, never that they were someone else - so gaining the
    // capability after submitting let you sign off your own change.
    const requester = await createUser(Role.ADMIN, {
      email: 'maker@test.com',
      password: 'Password123!',
    });
    const cookie = await loginCookie('maker@test.com', 'Password123!');

    // An ADMIN without APPROVE_CHANGES stages the change rather than applying.
    const proposed = await api()
      .post('/api/v1/group-categories')
      .set('Cookie', cookie)
      .send({ code: 'HALL', name: 'Hall' });
    expect(proposed.status).toBe(202);
    const changeId = bodyOf<{ data: { id: string } }>(proposed).data.id;

    // Now grant them the approver capability and let them try to self-approve.
    await prisma.accessGrant.create({
      data: { capability: 'APPROVE_CHANGES', userId: requester.id },
    });

    const approved = await api()
      .post(`/api/v1/change-requests/${changeId}/approve`)
      .set('Cookie', cookie)
      .send({});
    expect(approved.status).toBe(403);

    const stillPending = await prisma.changeRequest.findUniqueOrThrow({
      where: { id: changeId },
    });
    expect(stillPending.status).toBe('PENDING');
    expect(await prisma.groupCategory.count()).toBe(0);
  });
});
