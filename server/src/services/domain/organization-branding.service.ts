// src/services/domain/organization-branding.service.ts
//
// Branding image uploads (logo / favicon). Binary assets can't ride the
// maker-checker JSON payloads, so these apply directly - capability-gated at
// the route, audited here, old asset cleaned up after a successful swap.
import { type Role } from '../../../generated/prisma/client.js';
import prisma from '../../lib/prisma.js';
import { appendAudit } from '../audit/audit.service.js';
import { type AppDeps, defaultDeps } from '../deps.js';
import { getOrganization } from './organization.service.js';

export type BrandingField = 'faviconUrl' | 'logoUrl';

interface Actor {
  id: string;
  role: Role;
}

interface Ctx {
  ipAddress?: string;
  userAgent?: string;
}

export const makeOrganizationBrandingService = (
  d: Pick<AppDeps, 'cloudinary' | 'logger'>,
) => {
  const updateBrandingImage = async (
    field: BrandingField,
    image: { buffer: Buffer; mimetype?: string },
    actor: Actor,
    ctx: Ctx = {},
  ) => {
    const org = await getOrganization();
    const uploaded = await d.cloudinary.uploadImage(image, {
      folder: 'elektor-pro/branding',
    });
    const updated = await prisma.organization.update({
      data: { [field]: uploaded.secure_url },
      where: { id: org.id },
    });
    const previous = org[field];
    if (previous && previous !== uploaded.secure_url) {
      try {
        await d.cloudinary.deleteImage(previous);
      } catch (error) {
        d.logger.warn({ error, field }, 'Old branding asset cleanup failed');
      }
    }
    await appendAudit(prisma, {
      action:
        field === 'logoUrl'
          ? 'organization.logo_updated'
          : 'organization.favicon_updated',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Organization',
      entityId: org.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return updated;
  };

  /**
   * Puts a mark back to the platform's own.
   *
   * The column goes to null rather than to a URL, because "no mark of our
   * own" is what every reader already falls back on - the client hook, the
   * server metadata and the tab icon all resolve null to the Elektor Pro
   * default. Writing a default URL here would freeze today's default into the
   * database and outlive it.
   *
   * The asset is dropped after the row, and a failure to drop it is logged
   * rather than raised: the organization has stopped using the image either
   * way, and an orphan in Cloudinary is not worth failing the request over.
   */
  const clearBrandingImage = async (
    field: BrandingField,
    actor: Actor,
    ctx: Ctx = {},
  ) => {
    const org = await getOrganization();
    const previous = org[field];
    const updated = await prisma.organization.update({
      data: { [field]: null },
      where: { id: org.id },
    });
    if (previous) {
      try {
        await d.cloudinary.deleteImage(previous);
      } catch (error) {
        d.logger.warn({ error, field }, 'Branding asset cleanup failed');
      }
    }
    await appendAudit(prisma, {
      action:
        field === 'logoUrl'
          ? 'organization.logo_removed'
          : 'organization.favicon_removed',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Organization',
      entityId: org.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return updated;
  };

  return { clearBrandingImage, updateBrandingImage };
};

export const organizationBrandingService =
  makeOrganizationBrandingService(defaultDeps);
export const { clearBrandingImage, updateBrandingImage } =
  organizationBrandingService;
