// prisma/bootstrap.ts
//
// Production bootstrap: the smallest amount of data a real deployment needs
// before anyone can sign in. Deliberately NOT prisma/seed.ts, which exists to
// make a development database look alive and creates demo accounts sharing a
// single published password, a demo election, and fabricated ballots.
//
// What this creates:
//   - the Organization singleton, if absent
//   - the shipped role -> capability defaults, ONLY while that table is empty
//     (a super-admin's later edits are never re-applied over)
//   - one SUPER_ADMIN from ADMIN_* env, with a generated temporary password
//     printed once and mustChangePassword set
//
// Idempotent: safe to run on every deploy. An existing super-admin is left
// completely untouched - no password reset, no role change.
import { Role } from '../generated/prisma/client.js';
import ENV from '../src/config/env.js';
import prisma from '../src/lib/prisma.js';
import { appendAudit } from '../src/services/audit/audit.service.js';
import { hashPassword } from '../src/utils/password.js';
import { generateTempPassword } from '../src/utils/temp-password.js';
import { requireAdminEnv } from './admin-env.js';
import { ensureOrganization, ensureRoleCapabilities } from './baseline.js';

const bootstrapSuperAdmin = async (): Promise<void> => {
  // Explicit opt-in, the same shape the seed uses: the admin identity can sit
  // in the deploy's secrets permanently while the account is created on
  // exactly one run. The organization and capability defaults above are NOT
  // gated - a deployment needs those every release.
  if (!ENV.ADMIN_BOOTSTRAP_ENABLED) {
    console.log('• super admin skipped (ADMIN_BOOTSTRAP_ENABLED is not true)');
    return;
  }

  const existing = await prisma.user.findFirst({
    select: { email: true },
    where: { role: Role.SUPER_ADMIN },
  });
  if (existing) {
    console.log(`• super admin already exists (${existing.email ?? 'no email'})`);
    return;
  }

  // Absent admin identity is not a failure here: this runs as part of the
  // release command, and a deployment that never intends to bootstrap an
  // admin should not have its build fail over it.
  if (!ENV.ADMIN_EMAIL || !ENV.ADMIN_FIRST_NAME || !ENV.ADMIN_LAST_NAME) {
    console.log(
      '• bootstrap skipped: set ADMIN_EMAIL, ADMIN_FIRST_NAME and ADMIN_LAST_NAME to create the first super admin',
    );
    return;
  }
  const { email, firstName, lastName, phone } = requireAdminEnv();
  // Generated, never taken from env: an ADMIN_PASSWORD sitting in a
  // deployment's environment is a long-lived shared credential, and this one
  // has to be replaced on first sign-in anyway.
  const temporaryPassword = generateTempPassword();
  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      mustChangePassword: true,
      password: await hashPassword(temporaryPassword),
      phone: phone || null,
      role: Role.SUPER_ADMIN,
    },
    select: { id: true },
  });
  await appendAudit(prisma, {
    action: 'user.created',
    actorId: user.id,
    actorRole: Role.SUPER_ADMIN,
    entity: 'User',
    entityId: user.id,
    metadata: { bootstrap: true, role: Role.SUPER_ADMIN },
  });

  console.log('\nsuper admin created');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${temporaryPassword}`);
  console.log('  This password is shown ONCE and must be changed at first sign-in.\n');
};

async function main(): Promise<void> {
  console.log(`Bootstrapping Elektor Pro (NODE_ENV=${ENV.NODE_ENV})\n`);
  await ensureOrganization('Elektor Pro');
  await ensureRoleCapabilities();
  await bootstrapSuperAdmin();
  console.log('Bootstrap complete.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
