"use client";

import { useContext } from "react";

import type { Branding } from "@/types/api";

import { siteConfig } from "@/lib/site";
import { BrandingSeed } from "@/components/brand/branding-provider";
import { useGetBrandingQuery } from "@/redux/governance-api";

/**
 * The organization this deployment belongs to, falling back to the platform's
 * own identity.
 *
 * The query is public, so this works on the sign-in pages and the published
 * results a voter is sent to, not only inside the console. A deployment that
 * has never configured an organization gets Elektor Pro's name and mark, which
 * is the correct answer rather than an empty header.
 */
export interface BrandIdentity {
  /** The tab icon, when one has been uploaded. */
  faviconUrl: null | string;
  /** True when an organization has supplied its own mark. */
  hasLogo: boolean;
  logoUrl: string;
  name: string;
  supportEmail: null | string;
  supportPhone: null | string;
  website: null | string;
}

const PLATFORM: BrandIdentity = {
  faviconUrl: null,
  hasLogo: false,
  logoUrl: "/logo-mark.png",
  name: siteConfig.name,
  supportEmail: null,
  supportPhone: null,
  website: null,
};

export const brandFrom = (
  branding: Branding | null | undefined,
): BrandIdentity => {
  if (!branding) return PLATFORM;
  return {
    faviconUrl: branding.faviconUrl,
    hasLogo: Boolean(branding.logoUrl),
    logoUrl: branding.logoUrl ?? PLATFORM.logoUrl,
    name: branding.name || PLATFORM.name,
    supportEmail: branding.supportEmail,
    supportPhone: branding.supportPhone,
    website: branding.website,
  };
};

export const useBranding = (): BrandIdentity => {
  // No error branch on purpose: branding is decoration on pages that have
  // their own job. A failed lookup shows the platform identity rather than
  // breaking a sign-in form or a results page.
  const { data } = useGetBrandingQuery();
  // The server already resolved this, so the seed is what renders until the
  // query lands - which is what stops a refresh flashing the platform's name
  // before the organization's. The query still wins once it returns, so an
  // upload in the console shows without a reload.
  const seed = useContext(BrandingSeed);
  return brandFrom(data?.data ?? seed);
};
