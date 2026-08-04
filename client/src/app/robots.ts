import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    host: siteUrl,
    rules: {
      allow: "/",
      // Private consoles and account areas carry no SEO value.
      disallow: ["/admin", "/profile", "/vote/"],
      userAgent: "*",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
