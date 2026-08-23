// src/lib/branding-server.ts
//
// The organization's identity, read on the SERVER so the first HTML already
// carries it.
//
// Branding was fetched only from the browser, which meant every cold load
// painted the platform's own name and mark first and swapped them for the
// organization's once the query landed. On a refresh that reads as the wrong
// deployment for a moment, and on a slow connection it reads as the wrong
// deployment for longer than a moment.
import type { Branding } from "@/types/api";

import { env } from "./env";

/**
 * How long a rendered page may carry a stale identity.
 *
 * Short, because an admin who has just uploaded a logo expects to see it: the
 * console updates immediately from its own query, and this is only the window
 * in which a COLD load could still be served the previous mark.
 */
const REVALIDATE_SECONDS = 60;

/**
 * Never throws. Branding decorates pages that have their own job - a sign-in
 * form, a results page - and an API that is down or not yet reachable at
 * build time must not take those pages with it. The caller falls back to the
 * platform identity, which is the same answer the client hook gives.
 */
export const getServerBranding = async (): Promise<Branding | null> => {
  try {
    const res = await fetch(`${env.apiUrl}/branding`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["branding"] },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: Branding | null };
    return body.data ?? null;
  } catch {
    return null;
  }
};
