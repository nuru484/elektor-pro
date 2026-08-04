import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: siteConfig.backgroundColor,
    categories: ["productivity", "government", "utilities"],
    description: siteConfig.description,
    display: "standalone",
    icons: [
      { purpose: "any", sizes: "192x192", src: "/icon-192.png", type: "image/png" },
      { purpose: "any", sizes: "512x512", src: "/icon-512.png", type: "image/png" },
      // The full-bleed blue logo doubles as maskable (safe-zone friendly).
      { purpose: "maskable", sizes: "512x512", src: "/icon-512.png", type: "image/png" },
    ],
    lang: "en",
    name: `${siteConfig.name} - ${siteConfig.tagline}`,
    short_name: siteConfig.shortName,
    start_url: "/",
    theme_color: siteConfig.themeColor,
  };
}
