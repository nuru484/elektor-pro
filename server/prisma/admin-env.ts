// prisma/admin-env.ts
//
// ADMIN_* is read by exactly two scripts - the seed and the production
// bootstrap - so the assertion lives with them rather than in the env module
// every process loads. Seeding is a local chore; a deployment has no reason to
// carry an admin identity in its environment, and a default password sitting
// there would be a shared credential nobody chose.
import ENV from '../src/config/env.js';

export interface AdminEnv {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export const requireAdminEnv = (): AdminEnv => {
  const missing = (
    ['ADMIN_EMAIL', 'ADMIN_FIRST_NAME', 'ADMIN_LAST_NAME'] as const
  ).filter((name) => !ENV[name]);
  if (missing.length > 0) {
    throw new Error(
      `Set these environment variables first: ${missing.join(', ')}`,
    );
  }

  return {
    email: (ENV.ADMIN_EMAIL ?? '').toLowerCase().trim(),
    firstName: ENV.ADMIN_FIRST_NAME ?? '',
    lastName: ENV.ADMIN_LAST_NAME ?? '',
    phone: ENV.ADMIN_PHONE ?? '',
  };
};
