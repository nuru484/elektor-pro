// The posthog-js seam: silent without a key, and identity by opaque id only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  identify: vi.fn(),
  init: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));

const load = () => import("@/lib/analytics");

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("analytics without a key", () => {
  it("never initialises, captures or identifies", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const analytics = await load();
    analytics.initAnalytics();
    analytics.capturePageView("http://localhost/x");
    analytics.identifyUser("u1");
    analytics.resetAnalyticsUser();
    expect(analytics.analyticsEnabled).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
  });
});

describe("analytics with a key", () => {
  it("initialises once through the same-origin proxy with pageviews and autocapture off", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const analytics = await load();
    analytics.initAnalytics();
    analytics.initAnalytics();
    expect(analytics.analyticsEnabled).toBe(true);
    expect(posthog.init).toHaveBeenCalledOnce();
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "/ingest",
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        person_profiles: "identified_only",
      }),
    );
  });

  it("captures page views and identifies by id alone", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const analytics = await load();
    analytics.initAnalytics();
    analytics.capturePageView("http://localhost/results?e=1");
    analytics.identifyUser("u1");
    analytics.resetAnalyticsUser();
    expect(posthog.capture).toHaveBeenCalledWith("$pageview", {
      $current_url: "http://localhost/results?e=1",
    });
    expect(posthog.identify).toHaveBeenCalledWith("u1");
    expect(posthog.reset).toHaveBeenCalledOnce();
  });
});
