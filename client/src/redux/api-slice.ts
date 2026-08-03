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
]);

const skipsReauth = (args: FetchArgs | string): boolean => {
  const url = typeof args === "string" ? args : args.url;
  // Endpoints are declared relative and without a query string, but normalize
  // both so a stray leading slash or `?foo` can't silently miss the set.
  return NO_REAUTH_PATHS.has((url.split("?")[0] ?? "").replace(/^\/+/, ""));
};

const baseQueryWithReauth: BaseQueryFn<
  FetchArgs | string,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();
  let result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401 && !skipsReauth(args)) {
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
          api.dispatch(userLoggedIn({ user: refreshed.data }));
          result = await baseQuery(args, api, extraOptions);
        } else {
          // Refresh failed: the session is gone. Clear the user AND the RTK
          // Query cache - otherwise the 401 errors cached here survive the
          // forced logout and flash on every card after the next login.
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
    "AuditLog",
    "Candidate",
    "ChangeRequest",
    "CurrentUser",
    "Dashboard",
    "Election",
    "Group",
    "GroupCategory",
    "Organization",
    "Portfolio",
    "Results",
    "Sessions",
    "StaffUser",
    "Voter",
  ],
});
