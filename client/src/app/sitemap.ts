import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Login/portal/console pages are transactional or private (no SEO value);
  // public election results pages join this list once results URLs are
  // stable and meant to be discoverable.
  return [
    { changeFrequency: "weekly", lastModified: now, priority: 1, url: `${siteUrl}/` },
  ];
}
