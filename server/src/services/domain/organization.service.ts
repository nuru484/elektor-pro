import type { Prisma } from '../../../generated/prisma/client.js';
import type { Applier } from '../change-request/types.js';

// src/services/domain/organization.service.ts
import prisma from '../../lib/prisma.js';
import { NotFoundError } from '../../middlewares/error-handler.js';

/** The deployment is single-org: there is exactly one Organization row. */
export const getOrganization = async () => {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) throw new NotFoundError('Organization is not configured');
  return org;
};

export const getOrganizationOrNull = () =>
  prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });

export const organizationApplier: Applier = {
  create: async (tx, payload) => {
    const data = payload as Prisma.OrganizationCreateInput;
    return tx.organization.create({ data, select: { id: true } });
  },
  update: async (tx, id, payload) => {
    const data = payload as Prisma.OrganizationUpdateInput;
    return tx.organization.update({ data, select: { id: true }, where: { id } });
  },
};
