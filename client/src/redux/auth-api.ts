// src/redux/auth-api.ts
import type { ApiResponse, CurrentUser } from "@/types/api";
import { isAuthFailure } from "@/utils/extract-api-error";

import { apiSlice } from "./api-slice";
import { userLoggedIn, userLoggedOut } from "./auth/auth-slice";

interface LoginResult {
  data: CurrentUser | { challengeToken: string };
  message: string;
  requiresTwoFactor?: boolean;
  success: true;
}

/** Roles a visitor can try from the demo page. */
export type DemoRole =
  | "ACCREDITOR"
  | "ADMIN"
  | "AGENT"
  | "CANDIDATE"
  | "SUPER_ADMIN"
  | "VOTER";

export const authApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    activateTwoFactor: build.mutation<ApiResponse<{ recoveryCodes: string[] }>, { code: string }>({
      query: (body) => ({ body, method: "POST", url: "/auth/2fa/activate" }),
    }),
    demoLogin: build.mutation<ApiResponse<CurrentUser>, { role: DemoRole }>({
      invalidatesTags: ["CurrentUser"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const result = await queryFulfilled;
          dispatch(userLoggedIn({ user: result.data.data }));
        } catch {
          // The demo page surfaces the error; auth state is untouched.
        }
      },
      query: (body) => ({ body, method: "POST", url: "/auth/demo-login" }),
    }),
    getMe: build.query<ApiResponse<CurrentUser>, void>({
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const result = await queryFulfilled;
          dispatch(userLoggedIn({ user: result.data.data }));
        } catch (error) {
          // Only an auth failure clears the session. This query refetches
          // whenever a mutation invalidates CurrentUser, so a slow or briefly
          // unreachable API used to end the session mid-task: the refetch
          // timed out, the user was cleared, and the console guard bounced
          // the visitor to /login while their action was still in flight.
          // A timeout or a 5xx says nothing about whether they are signed in.
          if (isAuthFailure(error)) dispatch(userLoggedOut());
        }
      },
      providesTags: ["CurrentUser"],
      query: () => "/auth/me",
    }),
    login: build.mutation<LoginResult, { emailOrPhone: string; password: string }>({
      invalidatesTags: ["CurrentUser"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const result = await queryFulfilled;
          // A 2FA-required response carries a challenge token, not a user.
          if (!result.data.requiresTwoFactor && !("challengeToken" in result.data.data)) {
            dispatch(userLoggedIn({ user: result.data.data }));
          }
        } catch {
          // The form surfaces the error; auth state is untouched.
        }
      },
      query: (body) => ({ body, method: "POST", url: "/auth/login" }),
    }),
    logout: build.mutation<{ message: string }, void>({
      invalidatesTags: ["CurrentUser"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          // Locally signed out either way; also drop every cached query so
          // nothing from the previous session flashes after the next login.
          dispatch(userLoggedOut());
          dispatch(apiSlice.util.resetApiState());
        }
      },
      query: () => ({ method: "POST", url: "/auth/logout" }),
    }),
    setupTwoFactor: build.mutation<ApiResponse<{ otpAuthUrl: string; qrCode: string }>, void>({
      query: () => ({ method: "POST", url: "/auth/2fa/setup" }),
    }),
    verifyTwoFactor: build.mutation<
      ApiResponse<CurrentUser>,
      { challengeToken: string; code: string }
    >({
      invalidatesTags: ["CurrentUser"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const result = await queryFulfilled;
          dispatch(userLoggedIn({ user: result.data.data }));
        } catch {
          // The 2FA form surfaces the error.
        }
      },
      query: (body) => ({ body, method: "POST", url: "/auth/2fa/verify" }),
    }),
  }),
});

export const {
  useActivateTwoFactorMutation,
  useDemoLoginMutation,
  useGetMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useSetupTwoFactorMutation,
  useVerifyTwoFactorMutation,
} = authApi;
