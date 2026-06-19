// test/helpers.ts
import request from 'supertest';

import app from '../app.js';
import prisma from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { Role } from '../generated/prisma/client.js';

export { app, prisma };
export const api = () => request(app);

/** Truncate every table between tests. */
export const resetDb = async (): Promise<void> => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
};

export const createUser = async (
  role: Role,
  overrides: Partial<{ email: string; password: string; phone: string }> = {},
) => {
  const email = overrides.email ?? `${role.toLowerCase()}-${Date.now()}@test.com`;
  return prisma.user.create({
    data: {
      email,
      firstName: 'Test',
      lastName: role,
      password: await hashPassword(overrides.password ?? 'Password123!'),
      phone: overrides.phone ?? null,
      role,
    },
  });
};

/**
 * Turn a Set-Cookie response into a Cookie request header. Dedupes by name
 * keeping the last value (browser override semantics) and drops cleared cookies,
 * since issueSession emits a clear + a set for each token.
 */
export const toCookieHeader = (setCookie: string[] | string | undefined): string => {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const map = new Map<string, string>();
  for (const cookie of arr) {
    const pair = cookie.split(';')[0] ?? '';
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
  return [...map.entries()]
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
};

/** Log in and return the session Cookie header for authenticated requests. */
export const loginCookie = async (
  email: string,
  password = 'Password123!',
): Promise<string> => {
  const res = await api()
    .post('/api/v1/auth/login')
    .send({ emailOrPhone: email, password });
  return toCookieHeader(res.headers['set-cookie']);
};

/** Minimal election + portfolio + candidates for voting tests. */
export const createElectionFixture = async () => {
  const election = await prisma.election.create({
    data: {
      eligibilityMode: 'ALL_VOTERS',
      endDate: new Date(Date.now() + 86_400_000),
      name: 'Test Election',
      resultsPolicy: 'LIVE',
      slug: `test-${Date.now()}`,
      startDate: new Date(Date.now() - 3600_000),
      status: 'IN_PROGRESS',
    },
  });
  const portfolio = await prisma.portfolio.create({
    data: { electionId: election.id, name: 'President', votingMethod: 'SINGLE_CHOICE' },
  });
  const candidates = await Promise.all([
    prisma.candidate.create({
      data: { electionId: election.id, name: 'Alice', portfolioId: portfolio.id },
    }),
    prisma.candidate.create({
      data: { electionId: election.id, name: 'Bob', portfolioId: portfolio.id },
    }),
  ]);
  return { candidates, election, portfolio };
};

export const createVoterFixture = async (voterId: string, phone: string) => {
  const user = await prisma.user.create({
    data: { firstName: 'V', lastName: voterId, phone, role: Role.VOTER },
  });
  const voter = await prisma.voter.create({
    data: { name: `Voter ${voterId}`, phoneNumber: phone, userId: user.id, voterId },
  });
  return { user, voter };
};
