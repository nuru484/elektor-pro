// src/proxy.ts
//
// Server-side gate for the signed-in areas: requests with no session signal
// at all are redirected to /login before the console shell HTML/JS is
// served. Defense in depth only - data was never at risk (every API call is
// authenticated by the backend) - but this stops serving the console bundle
// to anonymous visitors and removes the client-side loading-screen redirect
// flash.
//
// Signals checked, any one suffices:
// - the httpOnly auth cookies (visible here when the API shares this site's
//   domain),
// - the ep_session marker the app sets on this domain at login (see
//   src/lib/session-marker.ts), which covers split-domain deployments.
//
// Security headers, the Content-Security-Policy included, are set in
// next.config.ts rather than here. A nonce-based CSP was tried first and
// rejected on evidence: Next only stamps the nonce onto scripts of
// DYNAMICALLY rendered pages, and most pages here prerender at build time, so
// the served HTML carried 28 script tags and none of them the nonce - under
// `script-src 'nonce-...' 'strict-dynamic'` the browser would have blocked
// every one and shipped a blank app. Making the whole app dynamic to satisfy
// the nonce would cost static rendering and CDN caching on the public pages.
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_MARKER_COOKIE } from "@/lib/session-marker";

export default function proxy(request: NextRequest) {
  const hasSessionSignal =
    request.cookies.has("accessToken") ||
    request.cookies.has("refreshToken") ||
    request.cookies.has(SESSION_MARKER_COOKIE);

  if (!hasSessionSignal) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/agent/:path*",
    "/accredit/:path*",
    "/candidate/:path*",
    "/profile",
  ],
};
