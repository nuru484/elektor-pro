// src/lib/site.ts
//
// Central site config - canonical URL, brand strings, and SEO defaults.
// Everything brand-facing (titles, descriptions, socials, theme color) lives
// here once; metadata, the OG card, the sitemap, and robots all read from it.

/** Canonical origin; trailing slash stripped so `${siteUrl}/path` is safe. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://elektorpro.com"
).replace(/\/$/, "");

export const siteConfig = {
  description:
    "Elektor Pro runs secure elections end to end for universities, unions, associations, and companies - secret ballots, live results, and outcomes everyone can verify.",
  keywords: [
    "Elektor Pro",
    "e-voting platform",
    "online voting system",
    "secure elections",
    "electronic voting",
    "SRC elections",
    "union elections",
    "election software",
    "secret ballot online",
    "verifiable voting",
  ],
  locale: "en_GH",
  name: "Elektor Pro",
  shortName: "ElektorPro",
  /** Social profiles (placeholders until the accounts exist). */
  socials: {
    facebook: "#",
    linkedin: "#",
    youtube: "#",
  },
  tagline: "Run elections everyone trusts",
  /** Dark ink page field - used for the PWA manifest background. */
  backgroundColor: "#161d17",
  /** Deep blue brand - used for theme-color and the OG card accent. */
  themeColor: "#126635",
  /** Full home-page title (the layout template's `default`). */
  title: "Elektor Pro · Run elections everyone trusts",
} as const;
