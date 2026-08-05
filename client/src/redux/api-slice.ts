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

import { userLoggedIn, userLoggedOut } from "./auth/auth-slice";

const mutex = new Mutex();

const baseQuery = fetchBaseQuery({
  baseUrl: env.apiUrl,
  credentials: "include",
});

/**
 * Endpoints where a 401 is the answer, not a symptom of an expired session.
 *
 * The reauth wrapper below reads a 401 as "the session died, refresh and
 * retry". That is wrong for the signed-out flows: a wrong password, a wrong
 * 2FA code, or a bad OTP legitimately answers 401 while the visitor has no
 * session at all. The refresh then fails too, and the `resetApiState()` in
 * that branch aborts every in-flight request - including the login mutation
 * still waiting on its own response, so the form would show "Aborted" instead
 * of the server's "Invalid credentials".
 *
 * These paths must surface their own error untouched. Signed-in endpoints are
 * deliberately absent: there a 401 really can mean an expired session, and the
 * refresh-and-retry is what keeps the request from failing spuriously.
 */
const NO_REAUTH_PATHS = new Set([
  "auth/login",
  "auth/2fa/verify",
  "auth/refresh",
  "auth/password/forgot",
  "auth/password/reset",
  "voter/otp/request",
  "voter/otp/verify",
  "voter/code-login",
]);

const skipsReauth = (args: FetchArgs | string): boolean => {
  const url = typeof args === "string" ? args : args.url;
  // Endpoints are declared relative and without a query string, but normalize
  // both so a stray leading slash or `?foo` can't silently miss the set.
  return NO_REAUTH_PATHS.has((url.split("?")[0] ?? "").replace(/^\/+/, ""));
};

/**
 * Once a refresh has failed, the session is KNOWN dead: every further 401 is
 * final until something signs in again. Without this latch, the
 * resetApiState() below makes still-subscribed queries refetch, those 401
 * again, trigger another refresh and another reset - an infinite loop that
 * hammers the server (the "shivering" log scroll) and aborts any login
 * request caught mid-reset.
 */
let sessionDead = false;

const baseQueryWithReauth: BaseQueryFn<
  FetchArgs | string,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();
  let result = await baseQuery(args, api, extraOptions);

  // A successful sign-in (login, 2FA, OTP, voting code) revives the session.
  if (!result.error && skipsReauth(args)) sessionDead = false;

  if (result.error?.status === 401 && !skipsReauth(args) && !sessionDead) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refresh = await baseQuery(
          { method: "POST", url: "/auth/refresh" },
          api,
          extraOptions,
        );
        const refreshed = refresh.data as ApiResponse<CurrentUser> | undefined;

        if (refreshed) {
          sessionDead = false;
          api.dispatch(userLoggedIn({ user: refreshed.data }));
          result = await baseQuery(args, api, extraOptions);
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
      } finally {
        release();
      }
    } else {
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }
  return result;
};

export const apiSlice = createApi({
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
  reducerPath: "api",
  tagTypes: [
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
