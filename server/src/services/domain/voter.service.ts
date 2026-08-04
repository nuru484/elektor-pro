import type { Prisma } from '../../../generated/prisma/client.js';
import type { TxClient } from '../../types/prisma.types.js';
import type { Applier } from '../change-request/types.js';

// src/services/domain/voter.service.ts
import prisma from '../../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';

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
} as const;

export const listVoters = async (
  filters: { groupId?: string; search?: string },
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

const createVoterInTx = async (
  tx: TxClient,
  input: VoterInput,
): Promise<{ id: string }> => {
  const voter = await tx.voter.create({
    data: {
      email: input.email ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      name: input.name,
      phoneNumber: input.phoneNumber ?? null,
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
    const { groupIds, ...rest } = payload as VoterInput;
    await tx.voter.update({
      data: {
        email: rest.email ?? undefined,
        metadata: (rest.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        name: rest.name,
        phoneNumber: rest.phoneNumber ?? undefined,
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
    return { id };
  },
};
