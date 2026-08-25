"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import {
  analyticsEnabled,
  capturePageView,
  identifyUser,
  initAnalytics,
  resetAnalyticsUser,
} from "@/lib/analytics";
import type { RootState } from "@/redux/store";

/**
 * One page view per App Router navigation. useSearchParams suspends during
 * static prerendering, which is why this lives under its own boundary.
 */
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams.toString();
    capturePageView(
      `${window.origin}${pathname}${query ? `?${query}` : ""}`,
    );
  }, [pathname, searchParams]);

  return null;
}

/**
 * Identifies the person when a session starts and forgets them when it
 * ends. Watches the auth store rather than the login page so a silent
 * refresh on a cold load attributes the session the same way an explicit
 * sign-in does.
 */
function IdentityTracker() {
  const userId = useSelector((state: RootState) => state.auth.user?.id ?? null);
  const previous = useRef<null | string>(null);

  useEffect(() => {
    if (userId === previous.current) return;
    if (userId) identifyUser(userId);
    else if (previous.current) resetAnalyticsUser();
    previous.current = userId;
  }, [userId]);

  return null;
}

/** Mounted once in the root layout, inside the Redux provider. Renders nothing without a key. */
export function PostHogProvider() {
  useEffect(() => {
    initAnalytics();
  }, []);

  if (!analyticsEnabled) return null;

  return (
    <>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <IdentityTracker />
    </>
  );
}
