// src/services/auth/demo-login.service.ts
//
// One-click demo sign-in for the portfolio deployment: the caller names a
// ROLE, never an account, and the server resolves the seeded fixture behind
// it. Nothing here trusts client input beyond the role name, and the demo
// accounts carry an unknown random password (see prisma/seed.ts) so this
// endpoint is the only way into them.
import { Role } from '../../../generated/prisma/client.js';
import ENV from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../middlewares/error-handler.js';

/** The roles a visitor may try. Order is the one the demo page renders. */
export const DEMO_ROLES = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.ACCREDITOR,
  Role.AGENT,
  Role.CANDIDATE,
  Role.VOTER,
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

const emailForRole = (role: Exclude<DemoRole, typeof Role.VOTER>): string =>
  ({
    [Role.ACCREDITOR]: ENV.DEMO_ACCREDITOR_EMAIL,
    [Role.ADMIN]: ENV.DEMO_ADMIN_EMAIL,
    [Role.AGENT]: ENV.DEMO_AGENT_EMAIL,
    [Role.CANDIDATE]: ENV.DEMO_CANDIDATE_EMAIL,
    [Role.SUPER_ADMIN]: ENV.DEMO_SUPER_ADMIN_EMAIL,
  })[role];

const notSeeded = (role: DemoRole): NotFoundError =>
  new NotFoundError(
    `The demo ${role} account is not set up. Seed the demo accounts first.`,
    { code: 'DEMO_ACCOUNT_NOT_FOUND' },
  );

/**
 * Resolve the demo principal for `role`.
 *
 * Voters are not staff users: they sign in against a Voter record, and the
 * session is issued for its linked login account - so the demo voter needs
 * one, exactly like a real voter who has been through OTP sign-in.
 *
 * `findFirst` (not `findUnique`) keeps the soft-delete extension in play: a
 * deleted demo account reads as unconfigured rather than signing anyone in.
 */
export const resolveDemoPrincipal = async (
  role: DemoRole,
): Promise<{ id: string; role: Role }> => {
  if (!ENV.DEMO_LOGIN_ENABLED) {
    throw new ForbiddenError('Demo sign-in is disabled.', {
      code: 'DEMO_LOGIN_DISABLED',
    });
  }

  if (role === Role.VOTER) {
    const voter = await prisma.voter.findFirst({
      select: { userId: true },
      where: { voterId: ENV.DEMO_VOTER_ID },
    });
    if (!voter?.userId) throw notSeeded(role);
    return { id: voter.userId, role: Role.VOTER };
  }

  const user = await prisma.user.findFirst({
    select: { id: true, role: true },
    where: { email: emailForRole(role) },
  });
  // The seeded account must still hold the role it is advertised under -
  // otherwise a demoted fixture would quietly hand out the wrong console.
  if (user?.role !== role) throw notSeeded(role);
  return { id: user.id, role: user.role };
};
