import {
  BallotEntryType,
  ElectionStatus,
  PortfolioEligibilityMode,
  ResultsPolicy,
  Role,
  VotingMethod,
} from '../generated/prisma/client.js';
// prisma/seed.ts
// Idempotent seed: organization, a super-admin + one of each role, optional
// voter groups, and a live demo election with portfolios, candidates, voters,
// and a batch of cast ballots so dashboards/results look alive.
import { DEFAULT_ROLE_CAPABILITIES, EDITABLE_ROLES } from '../src/config/capabilities.js';
import ENV from '../src/config/env.js';
import prisma from '../src/lib/prisma.js';
import { resolveEligiblePortfolios } from '../src/services/voting/eligibility.service.js';
import { type BallotSelection, castBallot } from '../src/services/voting/voting.service.js';
import { hashPassword } from '../src/utils/password.js';

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  // --- Organization (singleton) ---
  const existingOrg = await prisma.organization.findFirst();
  if (!existingOrg) {
    await prisma.organization.create({
      data: {
        accentColor: '#2563eb',
        name: 'Elektor Pro Demo',
        primaryColor: '#0f172a',
        settings: { showLiveTurnout: true },
        slug: 'elektor-pro',
        supportEmail: 'support@elektorpro.com',
      },
    });
    console.log('✓ organization created');
  }

  // --- Role capability matrix. Seeded ONLY while the table is empty: once a
  // super-admin has edited grants at runtime, re-running the seed must never
  // re-add a capability they revoked. ---
  const roleCapabilityCount = await prisma.roleCapability.count();
  if (roleCapabilityCount === 0) {
    await prisma.roleCapability.createMany({
      data: EDITABLE_ROLES.flatMap((role) =>
        DEFAULT_ROLE_CAPABILITIES[role].map((capability) => ({ capability, role })),
      ),
    });
    console.log('✓ role capability defaults seeded');
  }

  // --- Accounts ---
  const superAdmin = await upsertUser(
    ENV.ADMIN_EMAIL,
    ENV.ADMIN_FIRST_NAME,
    ENV.ADMIN_LAST_NAME,
    Role.SUPER_ADMIN,
    ENV.ADMIN_PASSWORD,
    ENV.ADMIN_PHONE,
  );
  await upsertUser('commission@elektorpro.com', 'Ada', 'Mensah', Role.ADMIN, 'Password123!', '+233200000002');
  const agent = await upsertUser('agent@elektorpro.com', 'Kojo', 'Asare', Role.AGENT, 'Password123!', '+233200000003');
  await upsertUser('candidate@elektorpro.com', 'Ama', 'Owusu', Role.CANDIDATE, 'Password123!', '+233200000004');
  console.log('✓ accounts ready (super-admin, admin, agent, candidate)');

  // --- Optional voter groups ---
  const college = await prisma.groupCategory.upsert({
    create: { code: 'COLLEGE', name: 'College' },
    select: { id: true },
    update: {},
    where: { name: 'College' },
  });
  const science = await prisma.group.upsert({
    create: { categoryId: college.id, code: 'SCI', name: 'Science' },
    select: { id: true },
    update: {},
    where: { code: 'SCI' },
  });
  await prisma.group.upsert({
    create: { categoryId: college.id, code: 'ART', name: 'Arts' },
    select: { id: true },
    update: {},
    where: { code: 'ART' },
  });

  await seedRichExtras(superAdmin.id, agent.id);

  // --- Demo election (skip if already seeded) ---
  const slug = 'src-general-election';
  if (await prisma.election.findUnique({ where: { slug } })) {
    console.log('✓ demo election already seeded — skipping');
    return;
  }

  const now = Date.now();
  const election = await prisma.election.create({
    data: {
      accreditationRequired: false,
      createdById: superAdmin.id,
      description: 'Annual Students Representative Council general election.',
      eligibilityMode: 'ALL_VOTERS',
      endDate: new Date(now + 7 * 86_400_000),
      name: 'SRC General Election',
      resultsPolicy: ResultsPolicy.LIVE,
      slug,
      startDate: new Date(now - 86_400_000),
      status: ElectionStatus.IN_PROGRESS,
    },
    select: { id: true },
  });

  const president = await prisma.portfolio.create({
    data: { electionId: election.id, name: 'President', order: 1, votingMethod: VotingMethod.SINGLE_CHOICE },
    select: { id: true },
  });
  const secretary = await prisma.portfolio.create({
    data: { electionId: election.id, name: 'General Secretary', order: 2, votingMethod: VotingMethod.SINGLE_CHOICE },
    select: { id: true },
  });
  const scienceRep = await prisma.portfolio.create({
    data: {
      electionId: election.id,
      eligibility: PortfolioEligibilityMode.ANY_OF_GROUPS,
      name: 'Science College Rep',
      order: 3,
      votingMethod: VotingMethod.SINGLE_CHOICE,
    },
    select: { id: true },
  });
  await prisma.portfolioEligibility.create({
    data: { groupId: science.id, portfolioId: scienceRep.id },
  });
  const council = await prisma.portfolio.create({
    data: {
      electionId: election.id,
      maxSelections: 3,
      name: 'Council Members',
      order: 4,
      votingMethod: VotingMethod.MULTI_SELECT,
    },
    select: { id: true },
  });
  const referendum = await prisma.portfolio.create({
    data: {
      allowAbstain: true,
      electionId: election.id,
      name: 'Adopt New Constitution',
      order: 5,
      votingMethod: VotingMethod.YES_NO,
    },
    select: { id: true },
  });

  const mkCandidates = (portfolioId: string, names: string[], nickname?: string[]) =>
    Promise.all(
      names.map((name, i) =>
        prisma.candidate.create({
          data: {
            electionId: election.id,
            name,
            nickname: nickname?.[i],
            order: i,
            portfolioId,
          },
          select: { id: true },
        }),
      ),
    );

  await mkCandidates(president.id, ['Kwame Boateng', 'Akosua Frimpong', 'Yaw Darko'], ['Unity', 'Progress', 'Forward']);
  await mkCandidates(secretary.id, ['Efua Sarpong', 'Kofi Adjei']);
  await mkCandidates(scienceRep.id, ['Nana Acheampong', 'Abena Mensah']);
  await mkCandidates(council.id, ['Member A', 'Member B', 'Member C', 'Member D', 'Member E']);
  await mkCandidates(referendum.id, ['Motion']);

  console.log('✓ election, portfolios, candidates created');

  // --- Voters (some in Science) + linked accounts ---
  const voterCount = 50;
  const voters: { id: string; userId: string }[] = [];
  for (let i = 1; i <= voterCount; i += 1) {
    const inScience = i % 3 === 0;
    const user = await prisma.user.create({
      data: {
        firstName: 'Voter',
        lastName: `#${i}`,
        phone: `+2335500000${String(i).padStart(2, '0')}`,
        role: Role.VOTER,
      },
      select: { id: true },
    });
    const voter = await prisma.voter.create({
      data: {
        name: `Voter ${i}`,
        phoneNumber: `+2335500000${String(i).padStart(2, '0')}`,
        userId: user.id,
        voterId: `STU${String(1000 + i)}`,
        ...(inScience ? { groupMemberships: { create: { groupId: science.id } } } : {}),
      },
      select: { id: true },
    });
    voters.push({ id: voter.id, userId: user.id });
  }
  console.log(`✓ ${voterCount} voters created`);

  // --- Cast ballots for ~70% of voters via the real voting path ---
  let cast = 0;
  for (const voter of voters) {
    if (Math.random() > 0.7) continue;
    const portfolios = await resolveEligiblePortfolios(voter.id, election.id);
    const selections: BallotSelection[] = portfolios.map((p) => {
      if (p.votingMethod === VotingMethod.YES_NO) {
        return { approve: Math.random() > 0.4, candidateIds: [p.candidates[0].id], portfolioId: p.id };
      }
      if (p.votingMethod === VotingMethod.MULTI_SELECT) {
        const shuffled = [...p.candidates].sort(() => Math.random() - 0.5).slice(0, p.maxSelections);
        return { candidateIds: shuffled.map((c) => c.id), portfolioId: p.id };
      }
      // single choice, occasional skip
      if (Math.random() > 0.92) return { portfolioId: p.id, type: BallotEntryType.SKIP };
      return { candidateIds: [pick(p.candidates).id], portfolioId: p.id };
    });
    await castBallot(voter.userId, election.id, selections);
    cast += 1;
  }
  console.log(`✓ ${cast} ballots cast`);

  // --- Assign the agent to observe this election ---
  await prisma.agentAssignment.create({
    data: { electionId: election.id, userId: agent.id },
  });

  console.log('\nSeed complete.');
  console.log(`  Super admin: ${ENV.ADMIN_EMAIL} / ${ENV.ADMIN_PASSWORD}`);
  console.log('  Admin: admin@elektorpro.com / Password123!');
  console.log('  Agent: agent@elektorpro.com / Password123!');
  console.log('  Voter login: use any voterId like STU1001 (OTP printed to server log in mock mode)');
}


/**
 * Rich demo data across every module - staff in each role and status, more
 * categories/groups, elections in several lifecycle states, assignments,
 * grants, pending change requests, and soft-deleted rows for the
 * deleted-records manager. Idempotent: gated on its marker election.
 */
async function seedRichExtras(superAdminId: string, agentId: string) {
  if (await prisma.election.findUnique({ where: { slug: 'departmental-election-2026' } })) {
    console.log('✓ rich demo data already seeded — skipping');
    return;
  }

  // Staff across roles and statuses
  const admin = await prisma.user.findFirst({
    select: { id: true },
    where: { email: 'commission@elektorpro.com' },
  });
  await upsertUser('accreditor@elektorpro.com', 'Efua', 'Adjei', Role.ACCREDITOR, 'Password123!', '+233200000005');
  const agent2 = await upsertUser('agent2@elektorpro.com', 'Yaw', 'Boakye', Role.AGENT, 'Password123!', '+233200000006');
  const candidate2 = await upsertUser('candidate2@elektorpro.com', 'Esi', 'Nyame', Role.CANDIDATE, 'Password123!', '+233200000007');
  const suspended = await upsertUser('suspended@elektorpro.com', 'Kwame', 'Dadzie', Role.ADMIN, 'Password123!', '+233200000008');
  await prisma.user.update({ data: { status: 'SUSPENDED' }, where: { id: suspended.id } });
  const locked = await upsertUser('locked@elektorpro.com', 'Abena', 'Sarpong', Role.ACCREDITOR, 'Password123!', '+233200000009');
  await prisma.user.update({
    data: { failedLoginAttempts: 5, lockedAt: new Date(), lockedReason: 'Too many failed sign-in attempts', status: 'LOCKED' },
    where: { id: locked.id },
  });

  // More categories and groups
  const level = await prisma.groupCategory.upsert({
    create: { code: 'LEVEL', description: 'Year of study', name: 'Level' },
    select: { id: true },
    update: {},
    where: { name: 'Level' },
  });
  const levelGroups = [];
  for (const name of ['Level 100', 'Level 200', 'Level 300', 'Level 400']) {
    const code = name.replace('Level ', 'L');
    levelGroups.push(
      await prisma.group.upsert({
        create: { categoryId: level.id, code, name },
        select: { id: true },
        update: {},
        where: { code },
      }),
    );
  }
  const hall = await prisma.groupCategory.upsert({
    create: { allowMultiple: false, code: 'HALL', description: 'Residence hall', name: 'Hall' },
    select: { id: true },
    update: {},
    where: { name: 'Hall' },
  });
  const unity = await prisma.group.upsert({
    create: { categoryId: hall.id, code: 'UNITY', name: 'Unity Hall' },
    select: { id: true },
    update: {},
    where: { code: 'UNITY' },
  });
  await prisma.group.upsert({
    create: { categoryId: hall.id, code: 'LEGACY', name: 'Legacy Hall' },
    select: { id: true },
    update: {},
    where: { code: 'LEGACY' },
  });

  // Elections in other lifecycle states
  const day = 86_400_000;
  const departmental = await prisma.election.create({
    data: {
      createdById: superAdminId,
      description: 'Departmental executives for the 2026/27 academic year.',
      eligibilityMode: 'ALL_VOTERS',
      endDate: new Date(Date.now() + 8 * day),
      name: 'Departmental Election 2026',
      resultsPolicy: 'ON_CLOSE',
      slug: 'departmental-election-2026',
      startDate: new Date(Date.now() + 7 * day),
      status: 'SCHEDULED',
    },
  });
  const deptPresident = await prisma.portfolio.create({
    data: { electionId: departmental.id, name: 'Department President', order: 1 },
  });
  const deptSecretary = await prisma.portfolio.create({
    data: { electionId: departmental.id, name: 'Secretary', order: 2 },
  });
  const deptCandidates = await Promise.all([
    prisma.candidate.create({
      data: { electionId: departmental.id, name: 'Nana Agyeman', nickname: 'Forward Group', order: 1, portfolioId: deptPresident.id },
    }),
    prisma.candidate.create({
      data: { electionId: departmental.id, name: 'Akosua Frimpong', nickname: 'Unity Ticket', order: 2, portfolioId: deptPresident.id },
    }),
    prisma.candidate.create({
      data: { electionId: departmental.id, name: 'Kofi Antwi', order: 1, portfolioId: deptSecretary.id },
    }),
    prisma.candidate.create({
      data: { electionId: departmental.id, name: 'Adjoa Baah', order: 2, portfolioId: deptSecretary.id },
    }),
  ]);
  const ended = await prisma.election.create({
    data: {
      createdById: superAdminId,
      description: 'Staff council for 2025 - closed and published.',
      eligibilityMode: 'ALL_VOTERS',
      endDate: new Date(Date.now() - 30 * day),
      name: 'Staff Council 2025',
      resultsPolicy: 'ON_CLOSE',
      resultsPublishedAt: new Date(Date.now() - 29 * day),
      slug: 'staff-council-2025',
      startDate: new Date(Date.now() - 31 * day),
      status: 'ENDED',
    },
  });
  await prisma.election.create({
    data: {
      createdById: superAdminId,
      description: 'Draft: amendments to the constitution.',
      eligibilityMode: 'ALL_VOTERS',
      endDate: new Date(Date.now() + 40 * day),
      name: 'Constitution Referendum',
      resultsPolicy: 'MANUAL',
      slug: 'constitution-referendum',
      startDate: new Date(Date.now() + 39 * day),
      status: 'DRAFT',
    },
  });

  // Extra voters with level/hall memberships
  for (let i = 1; i <= 30; i += 1) {
    const voter = await prisma.voter.create({
      data: {
        email: i % 4 === 0 ? `dep${String(2000 + i)}@example.com` : null,
        name: `Dept Voter ${String(i)}`,
        phoneNumber: `+23355${String(20000 + i).padStart(6, '0')}`,
        voterId: `DEP${String(2000 + i)}`,
      },
    });
    await prisma.voterGroupMembership.create({
      data: { groupId: levelGroups[i % levelGroups.length].id, voterId: voter.id },
    });
    if (i % 3 === 0) {
      await prisma.voterGroupMembership.create({
        data: { groupId: unity.id, voterId: voter.id },
      });
    }
  }

  // Agent assignments (one candidate-scoped, one general)
  await prisma.agentAssignment.create({
    data: { candidateId: deptCandidates[0].id, electionId: departmental.id, userId: agentId },
  });
  await prisma.agentAssignment.create({
    data: { electionId: ended.id, userId: agent2.id },
  });

  // Access grants: scoped + expiring, and a global one
  await prisma.accessGrant.create({
    data: {
      capability: 'ACCREDIT_VOTERS',
      electionId: departmental.id,
      expiresAt: new Date(Date.now() + 30 * day),
      grantedById: superAdminId,
      userId: agentId,
    },
  });
  await prisma.accessGrant.create({
    data: { capability: 'VIEW_RESULTS', grantedById: superAdminId, userId: candidate2.id },
  });

  // Change requests: pending and resolved history for the approvals console
  if (admin) {
    await prisma.changeRequest.create({
      data: {
        action: 'CREATE',
        entity: 'VOTER',
        payload: { name: 'Pending Voter', voterId: 'PEND9001' },
        requestedById: admin.id,
        summary: 'Create voter: Pending Voter',
      },
    });
    await prisma.changeRequest.create({
      data: {
        action: 'UPDATE',
        entity: 'ELECTION',
        entityId: departmental.id,
        payload: { description: 'Updated description pending review.' },
        requestedById: admin.id,
        summary: 'Update election: Departmental Election 2026',
      },
    });
    await prisma.changeRequest.create({
      data: {
        action: 'CREATE',
        entity: 'GROUP',
        payload: { categoryId: level.id, code: 'L500', name: 'Level 500' },
        requestedById: admin.id,
        reviewedAt: new Date(Date.now() - 2 * day),
        reviewedById: superAdminId,
        reviewNote: 'No such level in this faculty.',
        status: 'REJECTED',
        summary: 'Create group: Level 500',
      },
    });
  }

  // Soft-deleted rows for the deleted-records manager
  for (let i = 1; i <= 3; i += 1) {
    await prisma.voter.create({
      data: {
        deletedAt: new Date(Date.now() - i * day),
        name: `Removed Voter ${String(i)}`,
        voterId: `DEL${String(9000 + i)}`,
      },
    });
  }
  await prisma.candidate.create({
    data: {
      deletedAt: new Date(Date.now() - 4 * day),
      electionId: departmental.id,
      name: 'Withdrawn Candidate',
      portfolioId: deptPresident.id,
    },
  });
  await prisma.election.create({
    data: {
      deletedAt: new Date(Date.now() - 10 * day),
      endDate: new Date(Date.now() - 200 * day),
      name: 'Old Club Election',
      slug: 'old-club-election',
      startDate: new Date(Date.now() - 201 * day),
      status: 'ARCHIVED',
    },
  });
  const formerStaff = await upsertUser('former-staff@elektorpro.com', 'Kojo', 'Mensimah', Role.ADMIN, 'Password123!', '+233200000010');
  await prisma.user.update({ data: { deletedAt: new Date(Date.now() - 6 * day) }, where: { id: formerStaff.id } });
  await prisma.group.upsert({
    create: {
      categoryId: hall.id,
      code: 'CLOSED',
      deletedAt: new Date(Date.now() - 12 * day),
      name: 'Closed Hall',
    },
    update: {},
    where: { code: 'CLOSED' },
  });
  const removedAssignment = await prisma.agentAssignment.create({
    data: { electionId: ended.id, userId: agentId },
  });
  // The soft-delete extension rewrites this into deletedAt.
  await prisma.agentAssignment.delete({ where: { id: removedAssignment.id } });

  console.log('✓ rich demo data seeded (staff, groups, elections, agents, grants, change requests, deleted rows)');
}

async function upsertUser(
  email: string,
  firstName: string,
  lastName: string,
  role: Role,
  password: string,
  phone: string,
) {
  return prisma.user.upsert({
    create: {
      email,
      firstName,
      lastName,
      password: await hashPassword(password),
      phone,
      role,
      status: 'ACTIVE',
    },
    select: { id: true },
    update: { firstName, lastName, role },
    where: { email },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
