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
import {
  DEFAULT_ROLE_CAPABILITIES,
  EDITABLE_ROLES,
} from '../src/config/capabilities.js';
import ENV from '../src/config/env.js';
import prisma from '../src/lib/prisma.js';
import { appendAudit } from '../src/services/audit/audit.service.js';
import { hashPassword } from '../src/utils/password.js';
import { slugify } from '../src/utils/slug.js';
import { generateTempPassword } from '../src/utils/temp-password.js';

const bootstrapOrganization = async (): Promise<void> => {
  if ((await prisma.organization.count()) > 0) {
    console.log('• organization already present');
    return;
  }
  const name = process.env.ORGANIZATION_NAME ?? 'Elektor Pro';
  await prisma.organization.create({
    data: { name, slug: slugify(name) },
  });
  console.log(`organization created (${name})`);
};

const bootstrapRoleCapabilities = async (): Promise<void> => {
  if ((await prisma.roleCapability.count()) > 0) {
    console.log('• role capabilities already configured (left untouched)');
    return;
  }
  await prisma.roleCapability.createMany({
    data: EDITABLE_ROLES.flatMap((role) =>
      DEFAULT_ROLE_CAPABILITIES[role].map((capability) => ({ capability, role })),
    ),
  });
  console.log('role capability defaults seeded');
};

const bootstrapSuperAdmin = async (): Promise<void> => {
  const existing = await prisma.user.findFirst({
    select: { email: true },
    where: { role: Role.SUPER_ADMIN },
  });
  if (existing) {
    console.log(`• super admin already exists (${existing.email ?? 'no email'})`);
    return;
  }

  const email = ENV.ADMIN_EMAIL.toLowerCase().trim();
  // Generated, never taken from env: an ADMIN_PASSWORD sitting in a
  // deployment's environment is a long-lived shared credential, and this one
  // has to be replaced on first sign-in anyway.
  const temporaryPassword = generateTempPassword();
  const user = await prisma.user.create({
    data: {
      email,
      firstName: ENV.ADMIN_FIRST_NAME,
      lastName: ENV.ADMIN_LAST_NAME,
      mustChangePassword: true,
      password: await hashPassword(temporaryPassword),
      phone: ENV.ADMIN_PHONE || null,
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
  await bootstrapOrganization();
  await bootstrapRoleCapabilities();
  await bootstrapSuperAdmin();
  console.log('Bootstrap complete.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
