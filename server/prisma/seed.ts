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

  const mkCandidates = (portfolioId: string, names: string[], party?: string[]) =>
    Promise.all(
      names.map((name, i) =>
        prisma.candidate.create({
          data: {
            electionId: election.id,
            name,
            order: i,
            party: party?.[i],
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
