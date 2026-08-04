// src/services/domain/candidate.service.ts
import type { TxClient } from '../../types/prisma.types.js';
import type { Applier } from '../change-request/types.js';

import {
  CandidateStatus,
  type Prisma,
  Role,
} from '../../../generated/prisma/client.js';
import prisma from '../../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { hashPassword } from '../../utils/password.js';
import { generateTempPassword } from '../../utils/temp-password.js';
import { validateAndFormatPhone } from '../../utils/validate-phone.js';
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
export const listMyCandidacies = async (userId: string) =>
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
      portfolio: { select: { id: true, name: true } },
      profilePicture: true,
      reviewedAt: true,
      status: true,
      vettingNote: true,
    },
    where: { accountId: userId },
  });

interface CandidatePayload extends Record<string, unknown> {
  electionId?: string;
  email?: null | string;
  phone?: null | string;
  portfolioId?: string;
}

/**
 * Resolve the candidate's login account from their contact details: an
 * existing CANDIDATE account with the same email/phone is reused (one person,
 * many elections), otherwise a fresh account is created with a temporary
 * password delivered by email/SMS - candidates have no staff-issued IDs, so
 * their contact IS their sign-in identity.
 */
const ensureCandidateAccount = async (
  tx: TxClient,
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
    select: { id: true, role: true },
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
    return existing.id;
  }

  const temporaryPassword = generateTempPassword();
  const [firstName, ...restName] = name.trim().split(/\s+/);
  const user = await tx.user.create({
    data: {
      email: normalEmail,
      firstName: firstName || name,
      lastName: restName.join(' ') || '-',
      mustChangePassword: true,
      password: await hashPassword(temporaryPassword),
      phone: normalPhone,
      role: Role.CANDIDATE,
    },
    select: { id: true },
  });
  // Best-effort credential delivery on both channels; failures never lose the
  // nomination (the candidate can always use the password-reset flow).
  const message = `Hello ${firstName || name},\n\nYou have been nominated on Elektor Pro and a candidate account was created for you.\n\nTemporary password: ${temporaryPassword}\n\nSign in with your ${normalEmail ? 'email' : 'phone number'} and this password - you will be asked to set your own password before you can continue.`;
  if (normalEmail) {
    try {
      await defaultDeps.mail.send({
        email: normalEmail,
        subject: 'Your Elektor Pro candidate account',
        text: message,
      });
    } catch {
      /* delivery is best-effort */
    }
  }
  if (normalPhone) {
    try {
      await defaultDeps.sms.send(
        normalPhone,
        `Elektor Pro: you have been nominated. Sign in with your phone number and temporary password ${temporaryPassword}, then set your own password.`,
      );
    } catch {
      /* delivery is best-effort */
    }
  }
  return user.id;
};

const createCandidateInTx = async (
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
        select: { accountId: true, name: true },
        where: { id },
      });
      if (current && !current.accountId) {
        accountId = await ensureCandidateAccount(tx, current.name, email, phone);
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
