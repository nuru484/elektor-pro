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

  return { updateBrandingImage };
};

export const organizationBrandingService =
  makeOrganizationBrandingService(defaultDeps);
export const { updateBrandingImage } = organizationBrandingService;
