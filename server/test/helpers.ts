// test/helpers.ts
import request from 'supertest';

import type { AppDeps } from '../src/services/deps.js';

import app from '../app.js';
import { Role } from '../generated/prisma/client.js';
import { DEFAULT_ROLE_CAPABILITIES, EDITABLE_ROLES } from '../src/config/capabilities.js';
import prisma from '../src/lib/prisma.js';
import { _resetPasswordGateForTests } from '../src/services/auth/password-gate.service.js';
import { invalidateRoleCapabilityCache } from '../src/services/authorization/role-capability.service.js';
import { hashPassword } from '../src/utils/password.js';

export { app, prisma };
export const api = () => request(app);

/** Typed view of a supertest JSON body (supertest types `body` as any). */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- deliberate cast helper; the single-use generic IS the ergonomic point
export const bodyOf = <T>(res: { body: unknown }): T => res.body as T;

/** Truncate every table between tests, then restore baseline seed data. */
export const resetDb = async (): Promise<void> => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`;
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  }
  // Re-seed the role capability defaults (the runtime matrix) and drop its
  // cache so tests never see grants from a previous test's edits.
  await prisma.roleCapability.createMany({
    data: EDITABLE_ROLES.flatMap((role) =>
      DEFAULT_ROLE_CAPABILITIES[role].map((capability) => ({ capability, role })),
    ),
  });
  invalidateRoleCapabilityCache();
  _resetPasswordGateForTests();
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
export const toCookieHeader = (setCookie: string | string[] | undefined): string => {
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

// --- Fake-deps builder for factory-service tests -------------------------

export interface CapturedMail {
  email: string;
  subject: string;
  text?: string;
}

export interface CapturedSms {
  message: string;
  to: string;
}

/**
 * Deps for service-level tests: the REAL test-DB prisma client, a mutable
 * clock, and capturing sms/mail/cloudinary fakes. Extract OTP codes from the
 * captured messages with `codeFrom()`.
 */
export const makeTestDeps = () => {
  let nowMs = Date.now();
  const sentSms: CapturedSms[] = [];
  const sentMail: CapturedMail[] = [];
  const uploaded: string[] = [];
  const deleted: string[] = [];

  return {
    advanceClock: (ms: number) => {
      nowMs += ms;
    },
    deleted,
    // Structural fakes stand in for the pino/cloudinary surfaces; the cast is
    // safe because services only touch the methods provided here.
    deps: {
      clock: {
        now: () => new Date(nowMs),
        timestamp: () => nowMs,
      },
      cloudinary: {
        deleteImage: (publicId: string) => {
          deleted.push(publicId);
          return Promise.resolve({ result: 'ok' });
        },
        uploadImage: () => {
          const url = `https://res.cloudinary.com/test/upload/pic-${uploaded.length + 1}.png`;
          uploaded.push(url);
          return Promise.resolve({ public_id: `pic-${uploaded.length}`, secure_url: url });
        },
      },
      config: {
        FRONTEND_URL: 'http://localhost:3000',
        OTP_LENGTH: 6,
        OTP_MODE: 'mock' as const,
        OTP_TTL_MINUTES: 10,
      },
      logger: {
        debug: () => undefined,
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined,
      },
      mail: {
        send: (options: CapturedMail) => {
          sentMail.push(options);
          return Promise.resolve();
        },
      },
      prisma,
      sms: {
        send: (to: string, message: string) => {
          sentSms.push({ message, to });
          return Promise.resolve({ delivered: true, provider: 'mock' as const });
        },
      },
    } as unknown as AppDeps,
    sentMail,
    sentSms,
    uploaded,
  };
};

/** Pull the 6-digit code out of a captured SMS/email body. */
export const codeFrom = (text: string | undefined): string => {
  const match = /\b(\d{6})\b/.exec(text ?? '');
  if (!match) throw new Error(`No OTP code found in: ${text ?? '<empty>'}`);
  return match[1];
};
