import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

/**
 * The API origin the browser talks to. It is a different origin in most
 * deployments, so `connect-src 'self'` alone would block every request the
 * app makes - including the websocket the live results page opens.
 */
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4040/api/v1';
const apiOrigin = (() => {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return '';
  }
})();
const socketOrigin = apiOrigin.replace(/^http/, 'ws');

const isDev = process.env.NODE_ENV === 'development';

/**
 * Content-Security-Policy.
 *
 * Set here, statically, rather than per-request with a nonce. A nonce does
 * not work for this app: Next only stamps the nonce onto the scripts of
 * DYNAMICALLY rendered pages, and most pages here prerender at build time -
 * the served /login carries 28 script tags with zero nonces, which
 * `strict-dynamic` would block outright.
 * Buying the nonce would mean forcing every page dynamic and losing static
 * rendering and CDN caching on the public landing, legal, and results pages.
 *
 * So `script-src` keeps 'unsafe-inline' (Next's bootstrap needs it without a
 * nonce). That is the weakest line here, and it is survivable because the app
 * has no HTML-injection sink: no dangerouslySetInnerHTML, no innerHTML, no
 * eval anywhere in src/. Every other directive is strict, and they are the
 * ones carrying real weight - `frame-ancestors` stops an overlay harvesting
 * clicks on certify/approve/delete, and `connect-src` means script that did
 * somehow run could not exfiltrate a voter register to an attacker's host.
 *
 * Upgrade path, in order of preference: turn on Next's SRI support
 * (experimental.sri) which keeps static rendering AND drops 'unsafe-inline',
 * or move every page to dynamic rendering and reinstate the nonce.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // blob:/data: cover the local preview of a photo being uploaded and the 2FA
  // QR code, which is generated as a data URL. randomuser.me hosts the seeded
  // demo portraits.
  "img-src 'self' blob: data: https://res.cloudinary.com https://randomuser.me",
  "font-src 'self' data:",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin} ${socketOrigin}` : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Never leak an admin's URL - which carries election and candidate ids - to
  // a third-party site they navigate to.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // The legacy counterpart of `frame-ancestors 'none'`.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Nothing here needs these. Denying them stops a compromised dependency
  // from quietly asking a voter for their camera or location.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Only meaningful over HTTPS; inert on a local http origin.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  headers: () =>
    Promise.resolve([{ headers: securityHeaders, source: '/:path*' }]),
  images: {
    // Uploaded media lives on Cloudinary. Declaring it is what lets
    // next/image optimise these (resize, modern formats, lazy loading)
    // instead of shipping full-size originals to phones on mobile data - a
    // ballot page is mostly candidate photographs.
    remotePatterns: [
      { hostname: 'res.cloudinary.com', pathname: '/**', protocol: 'https' },
      // Seeded demo data fills missing profile photos with randomuser.me
      // portraits; without this entry next/image throws at runtime.
      {
        hostname: 'randomuser.me',
        pathname: '/api/portraits/**',
        protocol: 'https',
      },
    ],
  },
  // The version banner is free reconnaissance for an attacker.
  poweredByHeader: false,
};

/**
 * Source maps upload only when the three SENTRY_* build secrets are present;
 * without them the plugin skips the upload and the build still passes.
 * The tunnel keeps browser events on this origin, so the CSP connect-src above
 * stays closed to third-party hosts, and ad blockers cannot drop them.
 */
export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  tunnelRoute: '/monitoring',
  webpack: { treeshake: { removeDebugLogging: true } },
  widenClientFileUpload: true,
});
