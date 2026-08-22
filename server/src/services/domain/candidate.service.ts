// src/services/domain/candidate.service.ts
import type { TxClient } from '../../types/prisma.types.js';
import type { Applier } from '../change-request/types.js';

import {
  CandidateStatus,
  type Prisma,
  Role,
} from '../../../generated/prisma/client.js';
import { takeCredential } from '../../lib/credential-pool.js';
import { afterCommit } from '../../lib/outbox.js';
import prisma from '../../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { validateAndFormatPhone } from '../../utils/validate-phone.js';
import { appendAudit } from '../audit/audit.service.js';
import { defaultDeps } from '../deps.js';
import { assertElectionUnlocked } from './election.service.js';

/** Resolve a candidate's election and refuse writes once it is certified. */
const assertCandidateUnlocked = async (tx: TxClient, id: string): Promise<void> => {
  const candidate = await tx.candidate.findUnique({
    select: { electionId: true },
    where: { id },
  });
  if (!candidate) throw new NotFoundError('Candidate not found');
  await assertElectionUnlocked(tx, candidate.electionId);
};

const CANDIDATE_INCLUDE = {
  account: { select: { email: true, phone: true } },
  election: {
    select: {
      id: true,
      name: true,
      slug: true,
      vettingEnabled: true,
      vettingPassPercent: true,
    },
  },
  portfolio: { select: { id: true, name: true } },
  reviewedBy: { select: { firstName: true, id: true, lastName: true } },
} as const;

export const listCandidates = async (
  filters: {
    electionId?: string;
    excludeElectionId?: string;
    portfolioId?: string;
    search?: string;
    status?: CandidateStatus;
  },
  pagination: PaginationParams,
) => {
  const where: Prisma.CandidateWhereInput = {
    ...(filters.electionId ? { electionId: filters.electionId } : {}),
    ...(filters.portfolioId ? { portfolioId: filters.portfolioId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? { name: { contains: filters.search, mode: 'insensitive' } }
      : {}),
    // People NOT yet contesting in an election - powers the allocation
    // picker. Excludes candidacies of that election AND candidacies whose
    // person (login account) already contests there through another row.
    ...(filters.excludeElectionId
      ? {
          AND: [
            { electionId: { not: filters.excludeElectionId } },
            {
              NOT: {
                account: {
                  candidates: {
                    some: { electionId: filters.excludeElectionId },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.candidate.findMany({
      include: CANDIDATE_INCLUDE,
      orderBy: [{ portfolioId: 'asc' }, { order: 'asc' }],
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.candidate.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const getCandidate = async (id: string) => {
  const candidate = await prisma.candidate.findFirst({
    include: {
      ...CANDIDATE_INCLUDE,
      account: {
        select: { email: true, firstName: true, id: true, lastName: true, phone: true },
      },
    },
    where: { id },
  });
  if (!candidate) throw new NotFoundError('Candidate not found');

  // The same person's candidacies in other elections, linked via their login
  // account - the profile page shows their full history.
  const otherCandidacies = candidate.accountId
    ? await prisma.candidate.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          election: { select: { id: true, name: true, status: true } },
          id: true,
          portfolio: { select: { name: true } },
          status: true,
        },
        where: { accountId: candidate.accountId, id: { not: candidate.id } },
      })
    : [];
  return { ...candidate, otherCandidacies };
};

/**
 * The signed-in candidate's own candidacies (linked via their account),
 * powering the candidate console. Vetting details come from the redacted
 * per-candidate vetting endpoint.
 */
export const listMyCandidacies = async (
  userId: string,
  filters: { from?: Date; search?: string; to?: Date },
  pagination: PaginationParams,
) => {
  const where: Prisma.CandidateWhereInput = {
    accountId: userId,
    election: {
      ...(filters.search
        ? { name: { contains: filters.search, mode: 'insensitive' } }
        : {}),
      ...(filters.from ? { endDate: { gte: filters.from } } : {}),
      ...(filters.to ? { startDate: { lte: filters.to } } : {}),
    },
  };
  const [data, total] = await Promise.all([
    prisma.candidate.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      ballotNumber: true,
      election: {
        select: {
          endDate: true,
          id: true,
          name: true,
          resultsPolicy: true,
          resultsPublishedAt: true,
          slug: true,
          startDate: true,
          status: true,
          vettingEnabled: true,
          vettingPassPercent: true,
        },
      },
      id: true,
      manifesto: true,
      name: true,
      nickname: true,
      portfolio: {
        select: {
          // The field: everyone contesting the same portfolio, so the
          // candidate console can show who they are up against.
          candidates: {
            // Name and id break the tie when no ballot numbers are
            // assigned; without them the listing reshuffles per request.
            orderBy: [
              { ballotNumber: { nulls: 'last', sort: 'asc' } },
              { order: 'asc' },
              { name: 'asc' },
              { id: 'asc' },
            ],
            select: {
              ballotNumber: true,
              id: true,
              name: true,
              nickname: true,
              profilePicture: true,
              status: true,
            },
            where: { status: { not: 'WITHDRAWN' } },
          },
          id: true,
          name: true,
        },
      },
      profilePicture: true,
      reviewedAt: true,
      status: true,
      vettingNote: true,
    },
    skip: pagination.skip,
    take: pagination.limit,
    where,
    }),
    prisma.candidate.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

/**
 * Allocate EXISTING candidates (people already in the system) to a portfolio
 * in another election - the same person contesting again, without retyping
 * their details. Their login account carries over, so their candidacy
 * history links up. Refused for people already contesting in the target
 * election, and for locked elections.
 */
export const allocateCandidates = async (
  actor: { id: string; role: Role },
  electionId: string,
  input: { candidateIds: string[]; portfolioId: string },
  ctx: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ added: number; skipped: number }> => {
  const election = await prisma.election.findFirst({
    select: { id: true, vettingEnabled: true },
    where: { id: electionId },
  });
  if (!election) throw new NotFoundError('Election not found');
  await assertElectionUnlocked(prisma, electionId);

  const portfolio = await prisma.portfolio.findFirst({
    select: { id: true },
    where: { electionId, id: input.portfolioId },
  });
  if (!portfolio) {
    throw new BadRequestError('The portfolio must belong to this election', {
      code: 'PORTFOLIO_NOT_IN_ELECTION',
      layer: 'candidate',
    });
  }

  const sources = await prisma.candidate.findMany({
    select: {
      accountId: true,
      id: true,
      manifesto: true,
      name: true,
      nickname: true,
      partySymbol: true,
      profilePicture: true,
    },
    where: { id: { in: [...new Set(input.candidateIds)] } },
  });
  if (sources.length === 0) {
    throw new BadRequestError('No matching candidates to allocate', {
      code: 'EMPTY_ALLOCATION',
      layer: 'candidate',
    });
  }

  // People already contesting in this election (by account, or by name for
  // account-less legacy rows) are skipped, not duplicated.
  const [existingAccounts, existingNames] = await Promise.all([
    prisma.candidate.findMany({
      select: { accountId: true },
      where: { accountId: { not: null }, electionId },
    }),
    prisma.candidate.findMany({ select: { name: true }, where: { electionId } }),
  ]);
  const takenAccounts = new Set(existingAccounts.map((c) => c.accountId));
  const takenNames = new Set(existingNames.map((c) => c.name.trim().toLowerCase()));

  let added = 0;
  await prisma.$transaction(async (tx) => {
    for (const source of sources) {
      const duplicate = source.accountId
        ? takenAccounts.has(source.accountId)
        : takenNames.has(source.name.trim().toLowerCase());
      if (duplicate) continue;
      if (source.accountId) takenAccounts.add(source.accountId);
      takenNames.add(source.name.trim().toLowerCase());
      await tx.candidate.create({
        data: {
          ...(source.accountId
            ? { account: { connect: { id: source.accountId } } }
            : {}),
          election: { connect: { id: electionId } },
          manifesto: source.manifesto,
          name: source.name,
          nickname: source.nickname,
          partySymbol: source.partySymbol,
          portfolio: { connect: { id: input.portfolioId } },
          profilePicture: source.profilePicture,
          status: election.vettingEnabled
            ? CandidateStatus.DRAFT
            : CandidateStatus.QUALIFIED,
        },
        select: { id: true },
      });
      added += 1;
    }
    await appendAudit(tx, {
      action: 'candidate.allocated',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Election',
      entityId: electionId,
      ipAddress: ctx.ipAddress,
      metadata: {
        added,
        portfolioId: input.portfolioId,
        selected: input.candidateIds.length,
      },
      userAgent: ctx.userAgent,
    });
  });
  return { added, skipped: sources.length - added };
};

interface CandidatePayload extends Record<string, unknown> {
  electionId?: string;
  email?: null | string;
  phone?: null | string;
  portfolioId?: string;
}

/**
 * Resolve the candidate's login account from their contact details. An email
 * or phone belongs to exactly ONE person: an existing CANDIDATE account with
 * the same contact is reused only when it is clearly the same person (same
 * name) returning in a DIFFERENT election - anything else is a conflict.
 * Otherwise a fresh account is created with a temporary password delivered
 * by email/SMS - candidates have no staff-issued IDs, so their contact IS
 * their sign-in identity.
 */
const ensureCandidateAccount = async (
  tx: TxClient,
  electionId: string,
  name: string,
  email: null | string | undefined,
  phone: null | string | undefined,
): Promise<null | string> => {
  // Empty strings count as "not provided", hence the length check.
  const trimmedEmail = email?.toLowerCase().trim();
  const normalEmail = trimmedEmail?.length ? trimmedEmail : null;
  let normalPhone: null | string = null;
  if (phone) {
    // Stored in E.164 so phone sign-in (which normalises the same way) matches.
    try {
      normalPhone = validateAndFormatPhone(phone, 'GH').e164Format;
    } catch {
      throw new BadRequestError('The candidate phone number is not valid', {
        code: 'INVALID_PHONE',
        layer: 'candidate',
      });
    }
  }
  if (!normalEmail && !normalPhone) return null;

  const existing = await tx.user.findFirst({
    select: { firstName: true, id: true, lastName: true, role: true },
    where: {
      OR: [
        ...(normalEmail ? [{ email: normalEmail }] : []),
        ...(normalPhone ? [{ phone: normalPhone }] : []),
      ],
    },
  });
  if (existing) {
    if (existing.role !== Role.CANDIDATE) {
      throw new ConflictError(
        'This email or phone already belongs to a non-candidate account',
        { code: 'CONTACT_IN_USE', layer: 'candidate' },
      );
    }
    // Same contact, different name: two different people cannot share an
    // email or phone number.
    // Single-word names store '-' as the surname placeholder; ignore it.
    const accountName = [existing.firstName, existing.lastName]
      .filter((part) => part && part !== '-')
      .join(' ')
      .replaceAll(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    const givenName = name.replaceAll(/\s+/g, ' ').trim().toLowerCase();
    if (accountName !== givenName) {
      throw new ConflictError(
        'This email or phone already belongs to another candidate',
        { code: 'CONTACT_IN_USE', layer: 'candidate' },
      );
    }
    // Same person: allowed across elections (their history links up), but
    // never twice within the same election.
    const inThisElection = await tx.candidate.findFirst({
      select: { id: true },
      where: { accountId: existing.id, electionId },
    });
    if (inThisElection) {
      throw new ConflictError(
        'This email or phone already belongs to a candidate in this election',
        { code: 'CONTACT_IN_USE', layer: 'candidate' },
      );
    }
    return existing.id;
  }

  // Pre-hashed outside the transaction (see lib/credential-pool). Hashing
  // here instead costs ~300-500ms per nomination INSIDE the transaction, so a
  // bulk import of twenty exhausts the transaction budget and fails the
  // whole thing with a database error that never mentions passwords.
  const { hash, password: temporaryPassword } = await takeCredential();
  const [firstName, ...restName] = name.trim().split(/\s+/);
  const user = await tx.user.create({
    data: {
      email: normalEmail,
      firstName: firstName || name,
      lastName: restName.join(' ') || '-',
      mustChangePassword: true,
      password: hash,
      phone: normalPhone,
      role: Role.CANDIDATE,
    },
    select: { id: true },
  });
  // Credential delivery is deferred to AFTER the transaction commits. Inline
  // it would put a network round-trip on the transaction's critical path:
  // against a real SMTP relay each send costs seconds, and a bulk import of a
  // few nominations exhausts the transaction timeout and fails outright.
  // Deferring also means credentials never go out for a nomination that then
  // rolls back. Still best-effort: the candidate can always use password
  // reset, so a failed send must not lose the nomination.
  const message = `Hello ${firstName || name},\n\nYou have been nominated on Elektor Pro and a candidate account was created for you.\n\nTemporary password: ${temporaryPassword}\n\nSign in with your ${normalEmail ? 'email' : 'phone number'} and this password - you will be asked to set your own password before you can continue.`;
  if (normalEmail) {
    afterCommit(() =>
      defaultDeps.mail.send({
        email: normalEmail,
        subject: 'Your Elektor Pro candidate account',
        text: message,
      }),
    );
  }
  if (normalPhone) {
    afterCommit(() =>
      defaultDeps.sms.send(
        normalPhone,
        `Elektor Pro: you have been nominated. Sign in with your phone number and temporary password ${temporaryPassword}, then set your own password.`,
      ),
    );
  }
  return user.id;
};

export const createCandidateInTx = async (
  tx: TxClient,
  payload: CandidatePayload,
): Promise<{ id: string }> => {
  const { electionId, email, phone, portfolioId, ...rest } = payload;
  if (electionId) await assertElectionUnlocked(tx, electionId);
  // Vetting-enabled elections receive nominations as DRAFT; everywhere else
  // candidates go straight onto the ballot.
  const election = electionId
    ? await tx.election.findUnique({
        select: { vettingEnabled: true },
        where: { id: electionId },
      })
    : null;
  const accountId = await ensureCandidateAccount(
    tx,
    electionId ?? '',
    typeof rest.name === 'string' ? rest.name : '',
    email,
    phone,
  );
  return tx.candidate.create({
    data: {
      ...(rest as unknown as Prisma.CandidateCreateInput),
      ...(accountId ? { account: { connect: { id: accountId } } } : {}),
      election: { connect: { id: electionId } },
      portfolio: { connect: { id: portfolioId } },
      status: election?.vettingEnabled
        ? CandidateStatus.DRAFT
        : CandidateStatus.QUALIFIED,
    },
    select: { id: true },
  });
};

/** A nomination mints a login account when it carries a contact detail. */
const nominationNeedsAccount = (row: unknown): boolean => {
  const { email, phone } = (row ?? {}) as { email?: unknown; phone?: unknown };
  return Boolean(email) || Boolean(phone);
};

export const candidateApplier: Applier = {
  create: async (tx, payload) => {
    // Bulk shape from the file import; single shape from the nomination form.
    const maybeBulk = (payload as { candidates?: CandidatePayload[] }).candidates;
    if (Array.isArray(maybeBulk)) {
      let firstId = '';
      for (const candidate of maybeBulk) {
        const created = await createCandidateInTx(tx, candidate);
        if (!firstId) firstId = created.id;
      }
      return { id: firstId || 'bulk' };
    }
    return createCandidateInTx(tx, payload as CandidatePayload);
  },
  // An upper bound is enough: the pool falls back to hashing on demand if it
  // runs dry, and unused entries are simply discarded. Updates can mint an
  // account too, for a nomination that had none.
  credentialCount: (_action, payload) => {
    const rows = (payload as { candidates?: unknown[] }).candidates;
    if (Array.isArray(rows)) return rows.filter(nominationNeedsAccount).length;
    return nominationNeedsAccount(payload) ? 1 : 0;
  },
  remove: async (tx, id) => {
    await assertCandidateUnlocked(tx, id);
    return tx.candidate.delete({ select: { id: true }, where: { id } });
  },
  update: async (tx, id, payload) => {
    await assertCandidateUnlocked(tx, id);
    const { electionId: _e, email, phone, portfolioId, ...rest } =
      payload as CandidatePayload;
    // A contact on an account-less candidate creates their login account;
    // once linked, contact edits belong to user management, not nominations.
    let accountId: null | string = null;
    if (email || phone) {
      const current = await tx.candidate.findUnique({
        select: { accountId: true, electionId: true, name: true },
        where: { id },
      });
      if (current && !current.accountId) {
        accountId = await ensureCandidateAccount(
          tx,
          current.electionId,
          current.name,
          email,
          phone,
        );
      }
    }
    return tx.candidate.update({
      data: {
        ...(rest as Prisma.CandidateUpdateInput),
        ...(accountId ? { account: { connect: { id: accountId } } } : {}),
        ...(portfolioId ? { portfolio: { connect: { id: portfolioId } } } : {}),
      },
      select: { id: true },
      where: { id },
    });
  },
};
