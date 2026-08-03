// src/redux/auth-api.ts
import type { ApiResponse, CurrentUser } from "@/types/api";

import { apiSlice } from "./api-slice";
import { userLoggedIn, userLoggedOut } from "./auth/auth-slice";

interface LoginResult {
  data: CurrentUser | { challengeToken: string };
  message: string;
  requiresTwoFactor?: boolean;
  success: true;
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    activateTwoFactor: build.mutation<ApiResponse<{ recoveryCodes: string[] }>, { code: string }>({
      query: (body) => ({ body, method: "POST", url: "/auth/2fa/activate" }),
    }),
    getMe: build.query<ApiResponse<CurrentUser>, void>({
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const result = await queryFulfilled;
          dispatch(userLoggedIn({ user: result.data.data }));
        } catch {
          // A failed getMe after the silent refresh means no session.
          dispatch(userLoggedOut());
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
  useGetMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useSetupTwoFactorMutation,
  useVerifyTwoFactorMutation,
} = authApi;
