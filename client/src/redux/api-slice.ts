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

import { env } from "@/lib/env";

const mutex = new Mutex();

const baseQuery = fetchBaseQuery({
  baseUrl: env.apiUrl,
  credentials: "include",
});

const baseQueryWithReauth: BaseQueryFn<
  FetchArgs | string,
  unknown,
  FetchBaseQueryError
> = async (args, apiArg, extraOptions) => {
  await mutex.waitForUnlock();
  let result = await baseQuery(args, apiArg, extraOptions);

  if (result.error?.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refresh = await baseQuery(
          { method: "POST", url: "/auth/refresh" },
          apiArg,
          extraOptions,
        );
        if (refresh.data) {
          result = await baseQuery(args, apiArg, extraOptions);
        }
      } finally {
        release();
      }
    } else {
      await mutex.waitForUnlock();
      result = await baseQuery(args, apiArg, extraOptions);
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
    "StaffUser",
    "Voter",
  ],
});
