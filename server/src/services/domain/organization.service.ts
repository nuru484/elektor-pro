import type { Prisma } from '../../../generated/prisma/client.js';
import type { Applier } from '../change-request/types.js';

// src/services/domain/organization.service.ts
import prisma from '../../lib/prisma.js';
import { NotFoundError } from '../../middlewares/error-handler.js';

/**
 * The fields any surface is allowed to brand with, and the only ones the
 * system reads. The row still carries the retired colour, locale, timezone,
 * slug and settings columns: dropping them belongs in a migration that ships
 * AFTER this code is deployed, so a rolling release never has the previous
 * build selecting a column that no longer exists.
 */
const BRANDING_SELECT = {
  faviconUrl: true,
  id: true,
  logoUrl: true,
  name: true,
  supportEmail: true,
  supportPhone: true,
  website: true,
} as const;

export interface Branding {
  faviconUrl: null | string;
  logoUrl: null | string;
  name: string;
  supportEmail: null | string;
  supportPhone: null | string;
  website: null | string;
}

/**
 * Public branding for the surfaces a signed-out visitor reaches - the sign-in
 * pages and the published results a voter is sent to. Never throws: an
 * unconfigured deployment falls back to the platform's own identity rather
 * than failing a page that has nothing to do with settings.
 */
export const getBranding = async (): Promise<Branding | null> => {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
    select: BRANDING_SELECT,
  });
  if (!org) return null;
  return {
    faviconUrl: org.faviconUrl,
    logoUrl: org.logoUrl,
    name: org.name,
    supportEmail: org.supportEmail,
    supportPhone: org.supportPhone,
    website: org.website,
  };
};

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
