// src/redux/auth-api.ts
import type { ApiResponse, CurrentUser } from "@/types/api";

import { apiSlice } from "./api-slice";

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
      providesTags: ["CurrentUser"],
      query: () => "/auth/me",
    }),
    login: build.mutation<LoginResult, { emailOrPhone: string; password: string }>({
      invalidatesTags: ["CurrentUser"],
      query: (body) => ({ body, method: "POST", url: "/auth/login" }),
    }),
    logout: build.mutation<{ message: string }, void>({
      invalidatesTags: ["CurrentUser"],
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
