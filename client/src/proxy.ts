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
  matcher: ["/admin/:path*", "/agent/:path*", "/accredit/:path*", "/profile"],
};
