import {
  BallotEntryType,
  ElectionStatus,
  PortfolioEligibilityMode,
  type Prisma,
  ResultsPolicy,
  Role,
  VotingMethod,
} from '../generated/prisma/client.js';
// prisma/seed.ts
// Idempotent seed: organization, a super-admin + one of each role, optional
// voter groups, and a live demo election with portfolios, candidates, voters,
// and a batch of cast ballots so dashboards/results look alive.
import { DEFAULT_ROLE_CAPABILITIES, EDITABLE_ROLES } from '../src/config/capabilities.js';
import { GENESIS_HASH } from '../src/config/constants.js';
import ENV from '../src/config/env.js';
import prisma from '../src/lib/prisma.js';
import { appendAudit } from '../src/services/audit/audit.service.js';
import { computeResults } from '../src/services/results/results.service.js';
import { resolveEligiblePortfolios } from '../src/services/voting/eligibility.service.js';
import { type BallotSelection, castBallot } from '../src/services/voting/voting.service.js';
import { chainHash, generateReceiptCode, sha256, stableStringify } from '../src/utils/crypto.js';
import { hashPassword } from '../src/utils/password.js';

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Every seeded user account signs in with this (development data only). */
const SEED_PASSWORD = 'ORACLE1995@B9';

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

  // --- Accounts. One password for every seeded account (dev data only). ---
  const superAdmin = await upsertUser(
    ENV.ADMIN_EMAIL,
    ENV.ADMIN_FIRST_NAME,
    ENV.ADMIN_LAST_NAME,
    Role.SUPER_ADMIN,
    SEED_PASSWORD,
    ENV.ADMIN_PHONE,
  );
  await upsertUser('commission@elektorpro.com', 'Ada', 'Mensah', Role.ADMIN, SEED_PASSWORD, '+233200000002');
  const agent = await upsertUser('agent@elektorpro.com', 'Kojo', 'Asare', Role.AGENT, SEED_PASSWORD, '+233200000003');
  await upsertUser('candidate@elektorpro.com', 'Ama', 'Owusu', Role.CANDIDATE, SEED_PASSWORD, '+233200000004');
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
  await seedDemoElection(superAdmin.id, agent.id, science.id);
  await seedBuild5Extras(superAdmin.id);
  await seedVettingDemo(superAdmin.id);
  await seedWorstCaseEverywhere(superAdmin.id);

  console.log('\nSeed complete.');
  console.log(`  Super admin: ${ENV.ADMIN_EMAIL} / ${SEED_PASSWORD}`);
  console.log(`  Admin: commission@elektorpro.com / ${SEED_PASSWORD}`);
  console.log(`  Agent: agent@elektorpro.com / ${SEED_PASSWORD}`);
  console.log('  Voter login: use any voterId like STU1001 (OTP printed to server log in mock mode)');
}

/**
 * Build 5 demo data: a group-scoped election (ElectionEligibility + early
 * results access), a managed-roll election with every roll-entry state, a
 * certified election with a chained ballot history and an immutable result
 * snapshot, seed audit entries, and a worst-case election whose content sits
 * at every field's validation maximum so the UI can be checked against
 * extremes. Idempotent: gated on the scoped election's slug.
 */
async function seedBuild5Extras(superAdminId: string) {
  if (await prisma.election.findUnique({ where: { slug: 'science-departmental-2026' } })) {
    console.log('✓ build 5 demo data already seeded — skipping');
    return;
  }
  const day = 86_400_000;

  // --- Group-scoped election: only Science voters see or vote in it, and
  // agents may watch results early despite the ON_CLOSE policy. ---
  const science = await prisma.group.findUnique({
    select: { id: true },
    where: { code: 'SCI' },
  });
  if (!science) throw new Error('Seed order broken: Science group missing');
  const scoped = await prisma.election.create({
    data: {
      createdById: superAdminId,
      description:
        'College executives for Science. Group-scoped: voters outside the Science college cannot see this election at all.',
      eligibilityGroups: { create: [{ groupId: science.id }] },
      eligibilityMode: 'GROUPS',
      endDate: new Date(Date.now() + 5 * day),
      name: 'Science College Election 2026',
      resultsPolicy: ResultsPolicy.ON_CLOSE,
      settings: { resultsVisibleToRoles: ['AGENT'] },
      slug: 'science-departmental-2026',
      startDate: new Date(Date.now() - day),
      status: ElectionStatus.IN_PROGRESS,
    },
    select: { id: true },
  });
  const sciPresident = await prisma.portfolio.create({
    data: { electionId: scoped.id, name: 'College President', order: 1 },
    select: { id: true },
  });
  const sciCandidates = await Promise.all(
    ['Araba Quansah', 'Fiifi Tetteh'].map((name, i) =>
      prisma.candidate.create({
        data: { electionId: scoped.id, name, order: i, portfolioId: sciPresident.id },
        select: { id: true },
      }),
    ),
  );
  const scienceVoters = await prisma.voter.findMany({
    select: { id: true, userId: true },
    take: 8,
    where: { groupMemberships: { some: { groupId: science.id } }, userId: { not: null } },
  });
  for (const voter of scienceVoters) {
    if (!voter.userId) continue;
    await castBallot(voter.userId, scoped.id, [
      { candidateIds: [pick(sciCandidates).id], portfolioId: sciPresident.id },
    ]);
  }
  console.log('✓ group-scoped election seeded (Science-only, agent early results)');

  // --- Managed-roll election: every roll-entry state (eligible, excluded,
  // accredited, voted) so the Voters tab shows the full range. ---
  const congress = await prisma.election.create({
    data: {
      accreditationRequired: true,
      createdById: superAdminId,
      description: 'Delegates congress on an explicit roll; accreditation happens at the venue.',
      eligibilityMode: 'ROLL',
      endDate: new Date(Date.now() + 3 * day),
      name: 'Delegates Congress 2026',
      resultsPolicy: ResultsPolicy.LIVE,
      slug: 'delegates-congress-2026',
      startDate: new Date(Date.now() - day),
      status: ElectionStatus.IN_PROGRESS,
    },
    select: { id: true },
  });
  const chair = await prisma.portfolio.create({
    data: { electionId: congress.id, name: 'Congress Chairperson', order: 1 },
    select: { id: true },
  });
  const congressCandidates = await Promise.all(
    ['Maame Serwaa', 'Kobby Mettle'].map((name, i) =>
      prisma.candidate.create({
        data: { electionId: congress.id, name, order: i, portfolioId: chair.id },
        select: { id: true },
      }),
    ),
  );
  const delegates = await prisma.voter.findMany({
    orderBy: { voterId: 'asc' },
    select: { id: true },
    take: 12,
    where: { voterId: { startsWith: 'DEP' } },
  });
  for (const [i, delegate] of delegates.entries()) {
    await prisma.voterElection.create({
      data: {
        electionId: congress.id,
        // Two explicit exclusions; half of the rest already accredited.
        isEligible: i % 6 !== 5,
        voterId: delegate.id,
        ...(i % 2 === 0 && i % 6 !== 5
          ? { accreditedAt: new Date(Date.now() - i * 3_600_000), accreditedById: superAdminId }
          : {}),
      },
    });
  }
  // Two roll members with login accounts vote through the real path.
  for (const i of [1, 2]) {
    const user = await prisma.user.create({
      data: {
        firstName: 'Delegate',
        lastName: `#${String(i)}`,
        phone: `+23355600000${String(i)}`,
        role: Role.VOTER,
      },
      select: { id: true },
    });
    const voter = await prisma.voter.create({
      data: {
        name: `Congress Delegate ${String(i)}`,
        phoneNumber: `+23355600000${String(i)}`,
        userId: user.id,
        voterId: `CON${String(9000 + i)}`,
      },
      select: { id: true },
    });
    await prisma.voterElection.create({
      data: {
        accreditedAt: new Date(),
        accreditedById: superAdminId,
        electionId: congress.id,
        isEligible: true,
        voterId: voter.id,
      },
    });
    await castBallot(user.id, congress.id, [
      { candidateIds: [pick(congressCandidates).id], portfolioId: chair.id },
    ]);
  }
  await appendAudit(prisma, {
    action: 'election.roll_added',
    actorId: superAdminId,
    actorRole: Role.SUPER_ADMIN,
    entity: 'Election',
    entityId: congress.id,
    metadata: { added: delegates.length + 2, groupId: null },
  });
  console.log('✓ managed-roll election seeded (eligible, excluded, accredited, voted)');

  // --- Certify the ended Staff Council election: chained ballots, an
  // immutable snapshot, and the lock - the full post-election story. ---
  const staff = await prisma.election.findUnique({
    select: { id: true },
    where: { slug: 'staff-council-2025' },
  });
  if (staff) {
    const staffChair = await prisma.portfolio.create({
      data: { electionId: staff.id, name: 'Council Chair', order: 1 },
      select: { id: true },
    });
    const staffCandidates = await Promise.all(
      ['Adjoa Nkrumah', 'Kwesi Appiah'].map((name, i) =>
        prisma.candidate.create({
          data: { electionId: staff.id, name, order: i, portfolioId: staffChair.id },
          select: { id: true },
        }),
      ),
    );
    // The election is over, so the live casting path refuses it; write a
    // correctly chained history directly (same hash payload shape as
    // voting.service's hashEntries).
    const pastVoters = await prisma.voter.findMany({
      orderBy: { voterId: 'asc' },
      select: { id: true },
      take: 10,
      where: { voterId: { startsWith: 'STU' } },
    });
    let prevHash = GENESIS_HASH;
    for (const [i, voter] of pastVoters.entries()) {
      const candidateId = staffCandidates[i % 2].id;
      const castAt = new Date(Date.now() - 31 * day + i * 3_600_000);
      const sequence = i + 1;
      const hash = chainHash(prevHash, {
        castAt: castAt.toISOString(),
        electionId: staff.id,
        entries: [{ a: null, c: candidateId, p: staffChair.id, t: BallotEntryType.VOTE }],
        sequence,
      });
      await prisma.ballot.create({
        data: {
          castAt,
          electionId: staff.id,
          entries: {
            create: {
              approve: null,
              candidateId,
              portfolioId: staffChair.id,
              type: BallotEntryType.VOTE,
            },
          },
          hash,
          prevHash,
          receiptCode: generateReceiptCode(),
          sequence,
        },
      });
      prevHash = hash;
      await prisma.voterElection.create({
        data: { electionId: staff.id, hasVoted: true, votedAt: castAt, voterId: voter.id },
      });
    }
    const results = await computeResults(staff.id);
    const snapshotHash = sha256(stableStringify(results));
    await prisma.resultSnapshot.create({
      data: {
        certifiedById: superAdminId,
        data: results as unknown as Prisma.InputJsonValue,
        electionId: staff.id,
        hash: snapshotHash,
      },
    });
    await prisma.election.update({
      data: {
        certifiedAt: new Date(Date.now() - 28 * day),
        certifiedById: superAdminId,
        isLocked: true,
      },
      where: { id: staff.id },
    });
    await appendAudit(prisma, {
      action: 'results.certified',
      actorId: superAdminId,
      actorRole: Role.SUPER_ADMIN,
      entity: 'Election',
      entityId: staff.id,
      metadata: { hash: snapshotHash },
    });
    console.log('✓ Staff Council 2025 certified (chained ballots + snapshot + lock)');
  }

  // --- Worst-case content: every field at its validation maximum, plus an
  // unbroken token, so layouts are checked against extremes. DRAFT so it
  // never interferes with live voting flows. ---
  const UNBROKEN = 'Nnamdiokwuchukwuemekachimaamandaobianujuchukwudalunjemanachukwukadibiaegwuonwuchukwunonso';
  const sentence =
    'This extraordinary consolidated general election determines the leadership of every federated association, allied society, standing committee, and affiliated chapter for the coming administrative year. ';
  const longName = `Extraordinary Consolidated General Election of the Federated Union of Allied Student Associations and Societies ${UNBROKEN}`.slice(0, 150);
  const longDescription = sentence.repeat(12).slice(0, 2000);
  const longManifesto = sentence.repeat(30).slice(0, 5000);

  const worstCategory = await prisma.groupCategory.upsert({
    create: {
      code: 'WORST',
      description: sentence.repeat(3).slice(0, 500),
      name: 'Category With The Longest Permissible Name For Layout Checking Here'.slice(0, 80),
    },
    select: { id: true },
    update: {},
    where: { code: 'WORST' },
  });
  const worstGroup = await prisma.group.upsert({
    create: {
      categoryId: worstCategory.id,
      code: 'WORST-G',
      description: sentence.repeat(3).slice(0, 500),
      name: `Group With A Very Long Name ${UNBROKEN}`.slice(0, 120),
    },
    select: { id: true },
    update: {},
    where: { code: 'WORST-G' },
  });
  const worst = await prisma.election.create({
    data: {
      createdById: superAdminId,
      description: longDescription,
      eligibilityGroups: { create: [{ groupId: worstGroup.id }] },
      eligibilityMode: 'GROUPS',
      endDate: new Date(Date.now() + 60 * day),
      name: longName,
      resultsPolicy: ResultsPolicy.MANUAL,
      slug: 'worst-case-election-with-a-really-long-slug-for-layout-checking',
      startDate: new Date(Date.now() + 59 * day),
      status: ElectionStatus.DRAFT,
    },
    select: { id: true },
  });
  const worstPortfolio = await prisma.portfolio.create({
    data: {
      description: sentence.repeat(6).slice(0, 1000),
      electionId: worst.id,
      maxSelections: 5,
      name: `Portfolio With The Longest Permissible Name For Checking Layout Overflow Behaviour Everywhere ${UNBROKEN}`.slice(0, 150),
      order: 1,
      votingMethod: VotingMethod.MULTI_SELECT,
    },
    select: { id: true },
  });
  await prisma.candidate.create({
    data: {
      electionId: worst.id,
      manifesto: longManifesto,
      name: UNBROKEN.slice(0, 150) || 'Unbroken',
      nickname: `The ${UNBROKEN}`.slice(0, 120),
      order: 1,
      partySymbol: sentence.repeat(2).slice(0, 300),
      portfolioId: worstPortfolio.id,
    },
  });
  await prisma.candidate.create({
    data: {
      electionId: worst.id,
      manifesto: longManifesto,
      name: 'Nana Kwabena Osei-Bonsu Asante-Mensah Boakye-Yiadom Agyeman-Duah Ofori-Atta Kyeremateng Owusu-Ansah II'.slice(0, 150),
      nickname: 'Progress',
      order: 2,
      portfolioId: worstPortfolio.id,
    },
  });
  const worstVoter = await prisma.voter.create({
    data: {
      email: `worst.case.layout.checking.address.${'x'.repeat(40)}@extremely-long-subdomain.example-university-of-technology.edu.gh`,
      metadata: { hostel: `Block ${UNBROKEN.slice(0, 40)}`, notes: sentence.trim() },
      name: `Voter ${UNBROKEN}`.slice(0, 150),
      phoneNumber: '+233556999999',
      voterId: 'WORST-CASE-VOTER-IDENTIFICATION-NUMBER-000000000000000000001'.slice(0, 60),
    },
    select: { id: true },
  });
  await prisma.voterGroupMembership.create({
    data: { groupId: worstGroup.id, voterId: worstVoter.id },
  });
  console.log('✓ worst-case content seeded (max-length everything + unbroken tokens)');
}

/** The live SRC demo election with ballots. Idempotent: gated on its slug. */
async function seedDemoElection(superAdminId: string, agentId: string, scienceGroupId: string) {
  const slug = 'src-general-election';
  if (await prisma.election.findUnique({ where: { slug } })) {
    console.log('✓ demo election already seeded — skipping');
    return;
  }

  const superAdmin = { id: superAdminId };
  const agent = { id: agentId };
  const science = { id: scienceGroupId };
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

  console.log('✓ demo election seeded (portfolios, candidates, voters, ballots)');
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
  await upsertUser('accreditor@elektorpro.com', 'Efua', 'Adjei', Role.ACCREDITOR, SEED_PASSWORD, '+233200000005');
  const agent2 = await upsertUser('agent2@elektorpro.com', 'Yaw', 'Boakye', Role.AGENT, SEED_PASSWORD, '+233200000006');
  const candidate2 = await upsertUser('candidate2@elektorpro.com', 'Esi', 'Nyame', Role.CANDIDATE, SEED_PASSWORD, '+233200000007');
  const suspended = await upsertUser('suspended@elektorpro.com', 'Kwame', 'Dadzie', Role.ADMIN, SEED_PASSWORD, '+233200000008');
  await prisma.user.update({ data: { status: 'SUSPENDED' }, where: { id: suspended.id } });
  const locked = await upsertUser('locked@elektorpro.com', 'Abena', 'Sarpong', Role.ACCREDITOR, SEED_PASSWORD, '+233200000009');
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
  const formerStaff = await upsertUser('former-staff@elektorpro.com', 'Kojo', 'Mensimah', Role.ADMIN, SEED_PASSWORD, '+233200000010');
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

/**
 * Build 6 vetting demo on the Science election: vetting on, two criteria,
 * candidates in every lifecycle state with scores/notes, and ballot numbers
 * on the qualified ones. Idempotent via the criteria gate; looks its targets
 * up so it also runs on databases seeded before Build 6.
 */
async function seedVettingDemo(superAdminId: string) {
  if ((await prisma.vettingCriterion.count()) > 0) {
    console.log('✓ vetting demo already seeded — skipping');
    return;
  }
  const scopedElection = await prisma.election.findUnique({
    select: { id: true },
    where: { slug: 'science-departmental-2026' },
  });
  if (!scopedElection) {
    console.log('✓ vetting demo skipped (science election missing)');
    return;
  }
  const electionId = scopedElection.id;
  const portfolio = await prisma.portfolio.findFirst({
    select: { id: true },
    where: { electionId },
  });
  if (!portfolio) return;
  const portfolioId = portfolio.id;
  await prisma.election.update({
    data: { vettingEnabled: true },
    where: { id: electionId },
  });
  const academic = await prisma.vettingCriterion.create({
    data: {
      description: 'CGPA and academic good standing.',
      electionId,
      maxScore: 10,
      name: 'Academic standing',
      order: 1,
    },
  });
  const conduct = await prisma.vettingCriterion.create({
    data: {
      description: 'Disciplinary record and community conduct.',
      electionId,
      maxScore: 20,
      name: 'Conduct & integrity',
      order: 2,
    },
  });

  const mkNominee = (name: string, status: 'DISQUALIFIED' | 'DRAFT' | 'UNDER_REVIEW') =>
    prisma.candidate.create({
      data: {
        electionId,
        name,
        portfolioId,
        status,
        ...(status === 'DISQUALIFIED'
          ? {
              reviewedAt: new Date(),
              reviewedById: superAdminId,
              vettingNote: 'Incomplete nomination documents at the deadline.',
            }
          : {}),
      },
      select: { id: true },
    });
  await mkNominee('Kukua Bonsu', 'DRAFT');
  const underReview = await mkNominee('Jojo Quaye', 'UNDER_REVIEW');
  await mkNominee('Ekow Blankson', 'DISQUALIFIED');

  await prisma.vettingScore.createMany({
    data: [
      { candidateId: underReview.id, criterionId: academic.id, note: 'Strong CGPA', score: 8, scoredById: superAdminId },
      { candidateId: underReview.id, criterionId: conduct.id, score: 17, scoredById: superAdminId },
    ],
  });

  // Number the already-qualified candidates alphabetically per portfolio.
  const qualified = await prisma.candidate.findMany({
    orderBy: { name: 'asc' },
    select: { id: true },
    where: { electionId, portfolioId, status: 'QUALIFIED' },
  });
  for (const [index, candidate] of qualified.entries()) {
    await prisma.candidate.update({
      data: { ballotNumber: index + 1 },
      where: { id: candidate.id },
    });
  }
  console.log('✓ vetting demo seeded (criteria, nominees in every state, ballot numbers)');
}

/**
 * Worst-case content in EVERY remaining module - staff, agents, grants,
 * change requests, audit, vetting, the roll, a LIVE election with ballots
 * (so voting, results, and dashboards all carry extremes) - plus a bulk
 * batch of voters so dashboard counters show real four-digit numbers.
 * Idempotent: gated on the live worst-case election's slug.
 */
async function seedWorstCaseEverywhere(superAdminId: string) {
  if (await prisma.election.findUnique({ where: { slug: 'worst-case-live-results' } })) {
    console.log('✓ worst-case everywhere already seeded — skipping');
    return;
  }
  const UNBROKEN =
    'Nnamdiokwuchukwuemekachimaamandaobianujuchukwudalunjemanachukwukadibiaegwuonwuchukwunonso';
  const sentence =
    'This record exists so every screen in the console is checked against content at its permitted maximum length before real organisations meet it in production. ';
  const longName80 = `Verylongfirstnamethatkeepsgoingandgoing${UNBROKEN}`.slice(0, 80);

  // --- Bulk voters: four-digit dashboard counters. ---
  await prisma.voter.createMany({
    data: Array.from({ length: 1500 }, (_, i) => ({
      name: `Bulk Voter ${String(i + 1)}`,
      voterId: `WC${String(100000 + i)}`,
    })),
    skipDuplicates: true,
  });

  // --- Staff user at field maximums (users table, profile pages). ---
  const worstStaff = await prisma.user.upsert({
    create: {
      email: `worst.case.staff.${'x'.repeat(30)}@extremely-long-subdomain.example-university-of-technology.edu.gh`,
      firstName: longName80,
      lastName: `Surname${UNBROKEN}`.slice(0, 80),
      password: await hashPassword(SEED_PASSWORD),
      phone: '+233556999998',
      role: Role.ADMIN,
    },
    select: { id: true },
    update: {},
    where: { phone: '+233556999998' },
  });

  // --- Live worst-case election: voting portal, live results, dashboards. ---
  const day = 86_400_000;
  const live = await prisma.election.create({
    data: {
      createdById: superAdminId,
      description: sentence.repeat(12).slice(0, 2000),
      eligibilityMode: 'ALL_VOTERS',
      endDate: new Date(Date.now() + 6 * day),
      name: `Live Results Stress Election of the Consolidated Congress of Allied Societies ${UNBROKEN}`.slice(0, 150),
      resultsPolicy: ResultsPolicy.LIVE,
      slug: 'worst-case-live-results',
      startDate: new Date(Date.now() - day),
      status: ElectionStatus.IN_PROGRESS,
    },
    select: { id: true, name: true },
  });
  const livePortfolio = await prisma.portfolio.create({
    data: {
      description: sentence.repeat(6).slice(0, 1000),
      electionId: live.id,
      name: `Executive Portfolio With The Longest Permissible Name For Overflow Checking ${UNBROKEN}`.slice(0, 150),
      order: 1,
    },
    select: { id: true },
  });
  const liveCandidates = await Promise.all(
    [
      { name: UNBROKEN.slice(0, 150), nickname: `The ${UNBROKEN}`.slice(0, 120) },
      {
        name: 'Nana Kwabena Osei-Bonsu Asante-Mensah Boakye-Yiadom Agyeman-Duah Ofori-Atta Kyeremateng Owusu-Ansah III'.slice(0, 150),
        nickname: 'Progress Alliance For A Better Tomorrow And Beyond'.slice(0, 120),
      },
      { name: 'Adjoa Short', nickname: null },
    ].map((c, i) =>
      prisma.candidate.create({
        data: {
          electionId: live.id,
          manifesto: sentence.repeat(30).slice(0, 5000),
          name: c.name,
          nickname: c.nickname,
          order: i,
          portfolioId: livePortfolio.id,
        },
        select: { id: true },
      }),
    ),
  );
  const liveVoters = await prisma.voter.findMany({
    orderBy: { voterId: 'asc' },
    select: { userId: true },
    take: 6,
    where: { userId: { not: null }, voterId: { startsWith: 'STU' } },
  });
  for (const voter of liveVoters) {
    if (!voter.userId) continue;
    await castBallot(voter.userId, live.id, [
      { candidateIds: [pick(liveCandidates).id], portfolioId: livePortfolio.id },
    ]);
  }

  // --- Agent assignment + access grant carrying the long names. ---
  const worstAgent = await prisma.user.upsert({
    create: {
      email: 'worst.agent@elektorpro.com',
      firstName: `Agent${UNBROKEN}`.slice(0, 80),
      lastName: `Observer${UNBROKEN}`.slice(0, 80),
      password: await hashPassword(SEED_PASSWORD),
      phone: '+233556999997',
      role: Role.AGENT,
    },
    select: { id: true },
    update: {},
    where: { phone: '+233556999997' },
  });
  await prisma.agentAssignment.create({
    data: { candidateId: liveCandidates[0].id, electionId: live.id, userId: worstAgent.id },
  });
  await prisma.accessGrant.create({
    data: {
      capability: 'VIEW_RESULTS',
      electionId: live.id,
      grantedById: superAdminId,
      userId: worstStaff.id,
    },
  });

  // --- Maker-checker: a pending request with maximum-length prose. ---
  const admin = await prisma.user.findFirst({
    select: { id: true },
    where: { email: 'commission@elektorpro.com' },
  });
  if (admin) {
    await prisma.changeRequest.create({
      data: {
        action: 'UPDATE',
        entity: 'ELECTION',
        entityId: live.id,
        payload: { description: sentence.repeat(12).slice(0, 2000) },
        requestedById: admin.id,
        summary: `Update election: ${live.name} — ${sentence}`.slice(0, 500),
      },
    });
  }

  // --- Audit entry whose metadata carries the extremes. ---
  await appendAudit(prisma, {
    action: 'election.update',
    actorId: superAdminId,
    actorRole: Role.SUPER_ADMIN,
    entity: 'Election',
    entityId: live.id,
    ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    metadata: { name: live.name, note: sentence.repeat(3).slice(0, 400) },
    userAgent: `Mozilla/5.0 (StressTest) ${UNBROKEN}`,
  });

  // --- Vetting at maximums on the live election. ---
  await prisma.election.update({
    data: { vettingEnabled: true },
    where: { id: live.id },
  });
  const worstCriterion = await prisma.vettingCriterion.create({
    data: {
      description: sentence.repeat(3).slice(0, 500),
      electionId: live.id,
      maxScore: 100,
      name: `Criterion With The Longest Permissible Name ${UNBROKEN}`.slice(0, 120),
      order: 1,
    },
    select: { id: true },
  });
  const worstNominee = await prisma.candidate.create({
    data: {
      electionId: live.id,
      manifesto: sentence.repeat(30).slice(0, 5000),
      name: `Nominee ${UNBROKEN}`.slice(0, 150),
      order: 9,
      portfolioId: livePortfolio.id,
      status: 'UNDER_REVIEW',
      vettingNote: sentence.repeat(6).slice(0, 1000),
    },
    select: { id: true },
  });
  await prisma.vettingScore.create({
    data: {
      candidateId: worstNominee.id,
      criterionId: worstCriterion.id,
      note: sentence.repeat(6).slice(0, 1000),
      score: 87,
      scoredById: superAdminId,
    },
  });

  // --- The worst-case voter joins the congress roll (roll table extremes). ---
  const congress = await prisma.election.findUnique({
    select: { id: true },
    where: { slug: 'delegates-congress-2026' },
  });
  const worstVoter = await prisma.voter.findFirst({
    select: { id: true },
    where: { voterId: { startsWith: 'WORST-CASE' } },
  });
  if (congress && worstVoter) {
    await prisma.voterElection.upsert({
      create: {
        accreditedAt: new Date(),
        accreditedById: superAdminId,
        electionId: congress.id,
        isEligible: true,
        voterId: worstVoter.id,
      },
      update: {},
      where: {
        voterId_electionId: { electionId: congress.id, voterId: worstVoter.id },
      },
    });
  }

  console.log('✓ worst-case content seeded in every module (staff, agents, grants, approvals, audit, vetting, roll, live election + ballots, 1500 bulk voters)');
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
