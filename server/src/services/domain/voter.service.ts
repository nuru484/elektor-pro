import type { Prisma } from '../../../generated/prisma/client.js';
import type { TxClient } from '../../types/prisma.types.js';
import type { Applier } from '../change-request/types.js';

// src/services/domain/voter.service.ts
import prisma from '../../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { validateAndFormatPhone } from '../../utils/validate-phone.js';

/**
 * Contact fields are unique login identifiers, so they must be stored in ONE
 * canonical form: emails lowercased, phones in E.164. Without this, the same
 * address/number written differently ("Ama@x.com" / "024 000 0000") slips
 * past the unique constraints and registers twice.
 */
const normalizeVoterEmail = (email: null | string | undefined): null | string => {
  const trimmed = email?.toLowerCase().trim();
  return trimmed?.length ? trimmed : null;
};

const normalizeVoterPhone = (phone: null | string | undefined): null | string => {
  if (!phone?.trim()) return null;
  try {
    return validateAndFormatPhone(phone, 'GH').e164Format;
  } catch {
    throw new BadRequestError('The voter phone number is not valid', {
      code: 'INVALID_PHONE',
      layer: 'voter',
    });
  }
};

/**
 * Validate a group selection: every id must exist, and a category with
 * allowMultiple = false contributes at most one group. Enforced here (not in
 * Zod) because it needs the category rows.
 */
const assertGroupSelectionAllowed = async (
  tx: TxClient,
  groupIds: string[],
): Promise<void> => {
  const unique = [...new Set(groupIds)];
  const groups = await tx.group.findMany({
    select: {
      category: { select: { allowMultiple: true, id: true, name: true } },
      id: true,
    },
    where: { id: { in: unique } },
  });
  if (groups.length !== unique.length) {
    throw new BadRequestError('One or more selected groups do not exist', {
      code: 'UNKNOWN_GROUP',
      layer: 'voter',
    });
  }
  const perCategory = new Map<string, { count: number; name: string }>();
  for (const group of groups) {
    if (group.category.allowMultiple) continue;
    const entry = perCategory.get(group.category.id) ?? {
      count: 0,
      name: group.category.name,
    };
    entry.count += 1;
    perCategory.set(group.category.id, entry);
  }
  for (const { count, name } of perCategory.values()) {
    if (count > 1) {
      throw new BadRequestError(
        `Only one group from the "${name}" category may be selected`,
        { code: 'SINGLE_GROUP_CATEGORY', layer: 'voter' },
      );
    }
  }
};

export interface VoterInput {
  electionIds?: string[];
  email?: null | string;
  groupIds?: string[];
  metadata?: null | Record<string, unknown>;
  name: string;
  phoneNumber?: null | string;
  profilePicture?: null | string;
  voterId: string;
}

const VOTER_INCLUDE = {
  groupMemberships: {
    select: { group: { select: { category: { select: { name: true } }, id: true, name: true } } },
  },
  voterElections: {
    orderBy: { election: { startDate: 'desc' } },
    select: {
      accreditedAt: true,
      election: { select: { id: true, name: true, slug: true, status: true } },
      hasVoted: true,
      isEligible: true,
    },
  },
} as const satisfies Prisma.VoterInclude;

export const listVoters = async (
  filters: { excludeElectionId?: string; groupId?: string; search?: string },
  pagination: PaginationParams,
) => {
  const where: Prisma.VoterWhereInput = {
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { voterId: { contains: filters.search, mode: 'insensitive' } },
            { phoneNumber: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(filters.groupId
      ? { groupMemberships: { some: { groupId: filters.groupId } } }
      : {}),
    // Voters NOT yet part of an election (no roll entry AND not in any of its
    // scoped groups) - powers the "add existing voters" picker. AND-composed
    // so it cannot clash with the groupId membership filter above.
    ...(filters.excludeElectionId
      ? {
          AND: [
            {
              groupMemberships: {
                none: {
                  group: {
                    electionEligibility: {
                      some: { electionId: filters.excludeElectionId },
                    },
                  },
                },
              },
            },
            {
              voterElections: {
                none: { electionId: filters.excludeElectionId },
              },
            },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.voter.findMany({
      include: VOTER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.voter.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const getVoter = async (id: string) => {
  const voter = await prisma.voter.findFirst({
    include: VOTER_INCLUDE,
    where: { id },
  });
  if (!voter) throw new NotFoundError('Voter not found');
  return voter;
};

/** Every id must name an existing election; registration marks them eligible. */
const registerVoterElections = async (
  tx: TxClient,
  voterId: string,
  electionIds: string[],
): Promise<void> => {
  const unique = [...new Set(electionIds)];
  const found = await tx.election.count({ where: { id: { in: unique } } });
  if (found !== unique.length) {
    throw new BadRequestError('One or more selected elections do not exist', {
      code: 'UNKNOWN_ELECTION',
      layer: 'voter',
    });
  }
  await tx.voterElection.createMany({
    data: unique.map((electionId) => ({
      electionId,
      isEligible: true,
      voterId,
    })),
    skipDuplicates: true,
  });
};

const createVoterInTx = async (
  tx: TxClient,
  input: VoterInput,
): Promise<{ id: string }> => {
  const voter = await tx.voter.create({
    data: {
      email: normalizeVoterEmail(input.email),
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      name: input.name,
      phoneNumber: normalizeVoterPhone(input.phoneNumber),
      profilePicture: input.profilePicture ?? null,
      voterId: input.voterId,
    },
    select: { id: true },
  });
  if (input.groupIds?.length) {
    await assertGroupSelectionAllowed(tx, input.groupIds);
    await tx.voterGroupMembership.createMany({
      data: input.groupIds.map((groupId) => ({ groupId, voterId: voter.id })),
      skipDuplicates: true,
    });
  }
  if (input.electionIds?.length) {
    await registerVoterElections(tx, voter.id, input.electionIds);
  }
  return voter;
};

export const voterApplier: Applier = {
  create: async (tx, payload) => {
    const maybeBulk = (payload as { voters?: VoterInput[] }).voters;
    if (Array.isArray(maybeBulk)) {
      let firstId = '';
      for (const v of maybeBulk) {
        const created = await createVoterInTx(tx, v);
        if (!firstId) firstId = created.id;
      }
      return { id: firstId || 'bulk' };
    }
    return createVoterInTx(tx, payload as VoterInput);
  },
  remove: (tx, id) => tx.voter.delete({ select: { id: true }, where: { id } }),
  update: async (tx, id, payload) => {
    const { electionIds, groupIds, ...rest } = payload as VoterInput;
    await tx.voter.update({
      data: {
        email: rest.email === undefined ? undefined : normalizeVoterEmail(rest.email),
        metadata: (rest.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        name: rest.name,
        phoneNumber:
          rest.phoneNumber === undefined
            ? undefined
            : normalizeVoterPhone(rest.phoneNumber),
        profilePicture: rest.profilePicture ?? undefined,
      },
      where: { id },
    });
    if (groupIds) {
      // The final membership set is exactly groupIds, so validating the
      // incoming selection is sufficient.
      if (groupIds.length) await assertGroupSelectionAllowed(tx, groupIds);
      await tx.voterGroupMembership.deleteMany({
        where: { groupId: { notIn: groupIds }, voterId: id },
      });
      await tx.voterGroupMembership.createMany({
        data: groupIds.map((groupId) => ({ groupId, voterId: id })),
        skipDuplicates: true,
      });
    }
    // Additive only: registrations gain history (accreditation, ballots), so
    // removal goes through the roll tools, never a profile edit.
    if (electionIds?.length) {
      await registerVoterElections(tx, id, electionIds);
    }
    return { id };
  },
};
