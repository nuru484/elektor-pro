"use client";

import { createContext, useEffect } from "react";

import type { Branding } from "@/types/api";

import { useBranding } from "@/hooks/use-branding";

/**
 * The identity the SERVER already resolved, handed to the tree as its
 * starting value.
 *
 * `useBranding` reads this until its own query returns, so the first paint -
 * server and client alike - carries the organization's name and mark instead
 * of the platform's. The query still runs and still wins once it lands, which
 * is what keeps an admin's upload showing up without a reload.
 */
export const BrandingSeed = createContext<Branding | null>(null);

/**
 * Points the tab icon at the organization's favicon.
 *
 * Next renders the icon from the app's own metadata, so an uploaded favicon
 * changed a row in the database and nothing else: the tab kept the platform
 * mark until someone cleared their cache. The links are re-pointed here
 * instead, which also means a fresh upload lands in the tab straight away
 * rather than at the next revalidation.
 */
function FaviconSync() {
  const { faviconUrl } = useBranding();

  useEffect(() => {
    const links = [
      ...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
    ];
    if (links.length === 0 || !faviconUrl) return;

    // Keep what was there so clearing the organization's favicon puts the
    // platform's own mark back rather than leaving a broken one.
    const original = links.map((link) => ({ href: link.href, link }));
    for (const { link } of original) link.href = faviconUrl;

    return () => {
      for (const { href, link } of original) link.href = href;
    };
  }, [faviconUrl]);

  return null;
}

export function BrandingProvider({
  branding,
  children,
}: {
  branding: Branding | null;
  children: React.ReactNode;
}) {
  return (
    <BrandingSeed.Provider value={branding}>
      <FaviconSync />
      {children}
    </BrandingSeed.Provider>
  );
}
