// src/redux/api-slice.ts
// Central RTK Query API: cookie-credentialed base query with a mutex-guarded
// silent access-token refresh on 401.
import {
  type BaseQueryFn,
  createApi,
  type FetchArgs,
  fetchBaseQuery,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";

import type { ApiResponse, CurrentUser } from "@/types/api";

import { env } from "@/lib/env";

import { clearSessionMarker } from "@/lib/session-marker";
import { isAuthFailure } from "@/utils/extract-api-error";

import { userLoggedIn, userLoggedOut } from "./auth/auth-slice";

const mutex = new Mutex();

const baseQuery = fetchBaseQuery({
  baseUrl: env.apiUrl,
  credentials: "include",
});

/**
 * Endpoints that must never be answered with a refresh-and-retry.
 *
 * The reauth wrapper below reads a 401 as "the session died, refresh and
 * retry". That is wrong at a session boundary: a wrong password, a wrong 2FA
 * code or a bad OTP legitimately answers 401 while the visitor has no session
 * at all. The refresh then fails too, and the `resetApiState()` in that branch
 * aborts every in-flight request - including the login mutation still waiting
 * on its own response, so the form would show "Aborted" instead of the
 * server's "Invalid credentials".
 *
 * Logout is here for the opposite reason: a logout whose access token has
 * already expired would otherwise refresh - minting a new session at the
 * moment the visitor is trying to end one.
 *
 * Signed-in endpoints are deliberately absent: there a 401 really can mean an
 * expired session, and the refresh-and-retry is what keeps the request from
 * failing spuriously.
 */
const NO_REAUTH_PATHS = new Set([
  "auth/login",
  "auth/demo-login",
  "auth/logout",
  "auth/2fa/verify",
  "auth/refresh",
  "auth/password/forgot",
  "auth/password/reset",
  "voter/otp/request",
  "voter/otp/verify",
  "voter/code-login",
]);

/**
 * The subset that actually establishes a session. A success on one of these
 * clears the `sessionDead` latch.
 *
 * Kept separate from the set above because the two questions differ: logout
 * and the password-reset request skip the refresh but do not sign anyone in,
 * and reviving the latch on them would let a dead session retry forever. A
 * sign-in route missing from HERE is the bug that made demo sign-ins land
 * straight back on /login - the latch stayed set from the previous session and
 * the next 401 skipped the refresh entirely.
 */
const SESSION_ENTRY_PATHS = new Set([
  "auth/login",
  "auth/demo-login",
  "auth/2fa/verify",
  "voter/otp/verify",
  "voter/code-login",
]);

/** Endpoints are declared relative and without a query string, but normalize
 *  both so a stray leading slash or `?foo` can't silently miss a set. */
const pathOf = (args: FetchArgs | string): string => {
  const url = typeof args === "string" ? args : args.url;
  return (url.split("?")[0] ?? "").replace(/^\/+/, "");
};

const skipsReauth = (args: FetchArgs | string): boolean =>
  NO_REAUTH_PATHS.has(pathOf(args));

const isSessionEntry = (args: FetchArgs | string): boolean =>
  SESSION_ENTRY_PATHS.has(pathOf(args));

/**
 * Once a refresh has failed, the session is KNOWN dead: every further 401 is
 * final until something signs in again. Without this latch, the
 * resetApiState() below makes still-subscribed queries refetch, those 401
 * again, trigger another refresh and another reset - an infinite loop that
 * hammers the server (the "shivering" log scroll) and aborts any login
 * request caught mid-reset.
 */
let sessionDead = false;

/**
 * Counts completed refreshes.
 *
 * A request that 401s reads this before queueing on the mutex. If it has moved
 * by the time the lock is granted, another request already refreshed and this
 * one only needs to retry. Without it, several requests that 401 in the same
 * tick each pass the "is the mutex free" check before any of them acquires it,
 * and each then fires its own refresh - and because every refresh rotates the
 * token, the later ones can present one the server has already retired.
 */
let refreshGeneration = 0;

const baseQueryWithReauth: BaseQueryFn<
  FetchArgs | string,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();
  let result = await baseQuery(args, api, extraOptions);

  // A successful sign-in (login, demo, 2FA, OTP, voting code) revives the session.
  if (!result.error && isSessionEntry(args)) sessionDead = false;

  if (result.error?.status === 401 && !skipsReauth(args) && !sessionDead) {
    // Read before queueing: everything after the await may have changed.
    const generationAtFailure = refreshGeneration;
    const release = await mutex.acquire();
    try {
      if (refreshGeneration !== generationAtFailure) {
        // Another request refreshed while this one waited for the lock. The
        // cookies are already current, so retry rather than rotate again.
        result = await baseQuery(args, api, extraOptions);
      } else if (!sessionDead) {
        const refresh = await baseQuery(
          { method: "POST", url: "/auth/refresh" },
          api,
          extraOptions,
        );
        const refreshed = refresh.data as ApiResponse<CurrentUser> | undefined;

        if (refreshed) {
          refreshGeneration += 1;
          sessionDead = false;
          api.dispatch(userLoggedIn({ user: refreshed.data }));
          result = await baseQuery(args, api, extraOptions);
        } else if (!isAuthFailure(refresh.error)) {
          // The refresh itself failed for a reason that is not authentication
          // - a rate limit, a gateway error, a dropped connection. That says
          // nothing about whether the session is still valid, so surface THAT
          // failure rather than the original 401. Left as a 401 the caller
          // reads it as "signed out" and tears down a session that a retry a
          // second later would have renewed.
          result = { error: refresh.error ?? result.error };
        } else {
          // Refresh failed: the session is gone. Latch it FIRST so the
          // refetch wave caused by resetApiState() 401s once and stops,
          // instead of looping back into another refresh. Clear the user AND
          // the RTK Query cache - otherwise the 401 errors cached here
          // survive the forced logout and flash on every card after the next
          // login. The frontend-domain marker goes too, so the proxy gate
          // stops letting dead sessions load the console shell.
          sessionDead = true;
          clearSessionMarker();
          api.dispatch(userLoggedOut());
          api.dispatch(apiSlice.util.resetApiState());
        }
      }
    } finally {
      release();
    }
  }
  return result;
};

export const apiSlice = createApi({
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
  reducerPath: "api",
  tagTypes: [
    "Accreditors",
    "Agents",
    "AuditLog",
    "Candidate",
    "ChangeRequest",
    "CurrentUser",
    "Dashboard",
    "DeletedRecords",
    "Election",
    "Grants",
    "Group",
    "GroupCategory",
    "Organization",
    "Permissions",
    "Portfolio",
    "Results",
    "Roll",
    "Sessions",
    "StaffUser",
    "Vetting",
    "Voter",
  ],
});
