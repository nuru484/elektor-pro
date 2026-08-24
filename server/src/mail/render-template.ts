// src/mail/render-template.ts
//
// Renders an EJS template from src/ejs into the HTML body of an email, and
// brands it with the deployment's own organization - its name, its logo, its
// support address - so mail from an election looks like it came from the body
// running it rather than from the platform underneath.
import ejs from "ejs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ENV from "../config/env.js";
import { getBranding } from "../services/domain/organization.service.js";
import logger from "../utils/logger.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** FRONTEND_URL without a trailing slash, so joins never double up. */
const siteUrl = ENV.FRONTEND_URL.replace(/\/+$/, "");

/**
 * The console's palette, flattened to hex - email clients have no oklch and
 * no custom properties. Near-monochrome, like the interface: the ballot is
 * the thing on the page, not the chrome around it.
 */
export const BRAND = {
  /** The console's blue: the active-nav border, the status chips, the rule
   * under the masthead. Flattened from oklch(0.554 0.192 256). */
  accent: "#2f68e0",
  /** Body text and the dark bands. */
  ink: "#17181c",
  /** Secondary text on a pale background. */
  muted: "#6b7280",
  /** Secondary text on a dark band. */
  mutedOnDark: "#a1a5b0",
  /** Masthead band. */
  night: "#17181c",
  /** The sheet the message is printed on. */
  paper: "#ffffff",
  /** Buttons and rules that need to carry weight. */
  primary: "#17181c",
  /** Link text on a pale background. */
  primaryDeep: "#2f3238",
  /** Hairlines between rows. */
  rule: "#e2e5ea",
  /** The page behind the card. */
  surface: "#f4f5f7",
  /** Tint for callouts, detail blocks and the footer. */
  surfaceAlt: "#f8f9fb",
} as const;

const PLATFORM_NAME = "Elektor Pro";
const TAGLINE = "Secure elections";

interface BrandValues {
  brandName: string;
  brandTagline: string;
  logoUrl: null | string;
  siteUrl: string;
  supportEmail: null | string;
}

const PLATFORM_DEFAULTS: BrandValues = {
  brandName: PLATFORM_NAME,
  brandTagline: TAGLINE,
  /** Hosted rather than a cid attachment: an inline image makes every message
   * arrive wearing a paperclip, and it only resolves once FRONTEND_URL is a
   * public https origin - an inbox cannot fetch localhost. */
  logoUrl:
    ENV.EMAIL_LOGO_URL ??
    (siteUrl.startsWith("https") ? `${siteUrl}/logo-mark.png` : null),
  siteUrl,
  supportEmail: null,
};

/**
 * The organization row changes about as often as a deployment does, and an
 * announcement fans out one email per voter - so it is read once and held
 * briefly rather than fetched per message.
 */
const BRANDING_TTL_MS = 5 * 60 * 1000;
let cached: null | { at: number; values: BrandValues } = null;

const brandValues = async (now = Date.now()): Promise<BrandValues> => {
  if (cached && now - cached.at < BRANDING_TTL_MS) return cached.values;
  try {
    const branding = await getBranding();
    const values: BrandValues = branding
      ? {
          brandName: branding.name,
          brandTagline: TAGLINE,
          logoUrl: branding.logoUrl ?? PLATFORM_DEFAULTS.logoUrl,
          siteUrl: branding.website ?? siteUrl,
          supportEmail: branding.supportEmail,
        }
      : PLATFORM_DEFAULTS;
    cached = { at: now, values };
    return values;
  } catch (error) {
    // Branding is decoration: a database hiccup must not stop a sign-in code.
    logger.warn({ error }, "Email branding lookup failed; using platform defaults");
    return PLATFORM_DEFAULTS;
  }
};

/** Drops the cached organization branding (settings changes, tests). */
export const resetBrandingCache = (): void => {
  cached = null;
};

/**
 * Constrains a URL to http(s) before it lands in an href. Anything else
 * (javascript:, data:) collapses to the site root - a useless link beats a
 * script-in-mail-client vector.
 */
const safeUrl = (url: string): string =>
  /^https?:\/\//i.test(url) ? url : siteUrl;

export const renderTemplate = async (
  template: string,
  data: Record<string, unknown>,
): Promise<string> => {
  const action = data.action as undefined | { label: string; url: string };
  return ejs.renderFile(path.join(currentDir, "../ejs", template), {
    brand: BRAND,
    ...(await brandValues()),
    ...data,
    ...(action ? { action: { ...action, url: safeUrl(action.url) } } : {}),
  });
};
