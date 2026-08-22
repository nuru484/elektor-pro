// src/lib/session-marker.ts
//
// A non-sensitive "a session probably exists here" cookie on the FRONTEND
// domain. The real auth cookies are httpOnly and may live on the API domain
// (invisible to this app's proxy), so the server-side console gate needs a
// signal it can always see. This marker carries no auth value: forging it
// only yields the console shell HTML - every API call is still
// authenticated by the backend via the httpOnly cookies.
export const SESSION_MARKER_COOKIE = "ep_session";

/** Matches the refresh token's 7-day lifetime. */
const MARKER_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function setSessionMarker(): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${SESSION_MARKER_COOKIE}=1; path=/; max-age=${String(MARKER_MAX_AGE_SECONDS)}; samesite=lax${secure}`;
}

export function clearSessionMarker(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_MARKER_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Whether this browser previously marked a session (probably signed in). */
export function hasSessionMarker(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").includes(`${SESSION_MARKER_COOKIE}=1`);
}
