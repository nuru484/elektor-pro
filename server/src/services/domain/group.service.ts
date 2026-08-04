import type { Prisma } from '../../../generated/prisma/client.js';
import type { Applier } from '../change-request/types.js';

// src/services/domain/group.service.ts
import prisma from '../../lib/prisma.js';
import { NotFoundError } from '../../middlewares/error-handler.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';

// --- Group categories ---

export const listGroupCategories = async (
  filters: { search?: string },
  pagination: PaginationParams,
) => {
  const where: Prisma.GroupCategoryWhereInput = filters.search
    ? { name: { contains: filters.search, mode: 'insensitive' } }
    : {};
  const [data, total] = await Promise.all([
    prisma.groupCategory.findMany({
      include: { _count: { select: { groups: true } } },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.groupCategory.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const getGroupCategory = async (id: string) => {
  const category = await prisma.groupCategory.findFirst({
    include: { _count: { select: { groups: true } } },
    where: { id },
  });
  if (!category) throw new NotFoundError('Group category not found');
  return category;
};

export const groupCategoryApplier: Applier = {
  create: (tx, payload) =>
    tx.groupCategory.create({
      data: payload as Prisma.GroupCategoryCreateInput,
      select: { id: true },
    }),
  remove: (tx, id) => tx.groupCategory.delete({ select: { id: true }, where: { id } }),
  update: (tx, id, payload) =>
    tx.groupCategory.update({
      data: payload as Prisma.GroupCategoryUpdateInput,
      select: { id: true },
      where: { id },
    }),
};

// --- Groups ---

const GROUP_INCLUDE = {
  _count: { select: { voterMemberships: true } },
  category: { select: { id: true, name: true } },
  parent: { select: { id: true, name: true } },
} as const;

export const listGroups = async (
  filters: { categoryId?: string; search?: string },
  pagination: PaginationParams,
) => {
  const where: Prisma.GroupWhereInput = {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.search
      ? { name: { contains: filters.search, mode: 'insensitive' } }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.group.findMany({
      include: GROUP_INCLUDE,
      orderBy: { name: 'asc' },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.group.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

export const getGroup = async (id: string) => {
  const group = await prisma.group.findFirst({ include: GROUP_INCLUDE, where: { id } });
  if (!group) throw new NotFoundError('Group not found');
  return group;
};

export const groupApplier: Applier = {
  create: (tx, payload) => {
    const { categoryId, parentId, ...rest } = payload as Record<string, unknown> & {
      categoryId: string;
      parentId?: string;
    };
    return tx.group.create({
      data: {
        ...(rest as Prisma.GroupCreateInput),
        category: { connect: { id: categoryId } },
        ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
      },
      select: { id: true },
    });
  },
  remove: (tx, id) => tx.group.delete({ select: { id: true }, where: { id } }),
  update: (tx, id, payload) => {
    const { parentId, ...rest } = payload as Record<string, unknown> & {
      parentId?: null | string;
    };
    return tx.group.update({
      data: {
        ...(rest as Prisma.GroupUpdateInput),
        ...(parentId === undefined
          ? {}
          : parentId === null
            ? { parent: { disconnect: true } }
            : { parent: { connect: { id: parentId } } }),
      },
      select: { id: true },
      where: { id },
    });
  },
};
