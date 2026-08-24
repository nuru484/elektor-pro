// src/lib/sentry-options.ts - the Sentry.init options shared by the browser,
// Node and edge configs. With no DSN the SDK is disabled outright, so local
// dev, CI and tests never need a Sentry account.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProduction = process.env.NODE_ENV === "production";

export const sentryOptions = {
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV,
  // Voter and staff identity never leaves the app: no IP, cookies or headers.
  sendDefaultPii: false,
  tracesSampleRate: isProduction ? 0.1 : 0,
};
