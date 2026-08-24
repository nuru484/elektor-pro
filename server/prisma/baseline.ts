// prisma/baseline.ts
//
// The rows a deployment cannot function without, in one place because both
// entry points need them: `npm run bootstrap` on a real deployment and
// `npm run seed` on a development database. Two copies of this drift, and the
// one nobody runs is the one that goes stale.
//
// Everything here is create-only. The organization is a singleton a super
// admin edits at runtime, and the capability matrix is theirs to change too:
// re-running must never re-add a grant somebody deliberately revoked.
import {
  DEFAULT_ROLE_CAPABILITIES,
  EDITABLE_ROLES,
} from '../src/config/capabilities.js';
import prisma from '../src/lib/prisma.js';

/** The organization singleton, named from ORGANIZATION_NAME. */
export const ensureOrganization = async (fallbackName: string): Promise<void> => {
  if ((await prisma.organization.count()) > 0) {
    console.log('• organization already present');
    return;
  }
  const name = process.env.ORGANIZATION_NAME ?? fallbackName;
  await prisma.organization.create({ data: { name } });
  console.log(`organization created (${name})`);
};

/** The shipped role to capability defaults, only while the table is empty. */
export const ensureRoleCapabilities = async (): Promise<void> => {
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
