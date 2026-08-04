// src/lib/seo.ts
//
// Shared per-page metadata builder (the Khady's Kitchen pattern): one helper
// produces title/description/canonical/OG/Twitter for a page, with central
// clamping so no page can overflow search-result or share-card limits.
import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";

interface PageMetaInput {
  description: string;
  /** Set false for transactional/private pages (login, portal). */
  index?: boolean;
  keywords?: string[];
  /** Absolute path, e.g. "/vote" - canonical + OG url. */
  path: string;
  title: string;
}

// Search results truncate titles around 60 characters and social previews cut
// descriptions near 125 - clamp centrally so no page can overflow either.
const MAX_TITLE = 60;
const MAX_DESCRIPTION = 125;

const clampTitle = (title: string): string => {
  const suffix = ` · ${siteConfig.name}`;
  const budget = MAX_TITLE - suffix.length;
  const page =
    title.length > budget ? `${title.slice(0, budget - 1).trimEnd()}…` : title;
  return `${page}${suffix}`;
};

export const clampDescription = (description: string): string => {
  if (description.length <= MAX_DESCRIPTION) return description;
  // Cut on a word boundary so the ellipsis never splits a word.
  const slice = description.slice(0, MAX_DESCRIPTION - 1);
  const atWord = slice.slice(0, slice.lastIndexOf(" "));
  return `${(atWord || slice).trimEnd()}…`;
};

export function pageMetadata({
  description: rawDescription,
  index = true,
  keywords,
  path,
  title,
}: PageMetaInput): Metadata {
  const fullTitle = clampTitle(title);
  const description = clampDescription(rawDescription);
  return {
    alternates: { canonical: path },
    description,
    keywords,
    openGraph: {
      description,
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      title: fullTitle,
      type: "website",
      url: path,
    },
    robots: index ? undefined : { follow: true, index: false },
    title: { absolute: fullTitle },
    twitter: {
      card: "summary_large_image",
      description,
      title: fullTitle,
    },
  };
}
