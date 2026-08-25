// src/lib/analytics.ts - the posthog-js seam. Components never import
// posthog-js themselves; everything here is a no-op until
// NEXT_PUBLIC_POSTHOG_KEY is set, so local dev, CI and tests never contact
// PostHog. Events travel through the same-origin /ingest rewrite (see
// next.config.ts), which keeps the CSP connect-src closed to third parties.
import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export const analyticsEnabled = Boolean(key);

let initialized = false;

export const initAnalytics = (): void => {
  if (!key || initialized) return;
  posthog.init(key, {
    api_host: "/ingest",
    // Clicks and form fields on a ballot are not analytics material: only
    // the explicit events below and page views are recorded.
    autocapture: false,
    // Page views are captured by hand on App Router navigation; the SDK's
    // own listener only fires on full page loads.
    capture_pageview: false,
    disable_session_recording: true,
    // A person is created only once identify() runs, so anonymous voters
    // and visitors never become profiles.
    person_profiles: "identified_only",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com",
  });
  initialized = true;
};

export const capturePageView = (url: string): void => {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: url });
};

/** Ties the session to the signed-in principal by opaque id only: no email, no name. */
export const identifyUser = (id: string): void => {
  if (!initialized) return;
  posthog.identify(id);
};

/** Forgets the identified person on logout so the next sign-in is not attributed to the previous one. */
export const resetAnalyticsUser = (): void => {
  if (!initialized) return;
  posthog.reset();
};
