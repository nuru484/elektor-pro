// src/redux/profile-api.ts - profile self-service, sessions, 2FA enrollment,
// and password endpoints for every role.
import type { ApiResponse, CurrentUser, SessionView } from "@/types/api";

import { apiSlice } from "./api-slice";
import { userLoggedIn } from "./auth/auth-slice";

/** Sync the auth slice whenever an endpoint returns the updated user. */
const syncUser = {
  async onQueryStarted(
    _arg: unknown,
    {
      dispatch,
      queryFulfilled,
    }: {
      dispatch: (action: unknown) => unknown;
      queryFulfilled: Promise<{ data: ApiResponse<CurrentUser> }>;
    },
  ) {
    try {
      const result = await queryFulfilled;
      dispatch(userLoggedIn({ user: result.data.data }));
    } catch {
      // The form surfaces the error.
    }
  },
};

export const profileApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    activateEmailTwoFactor: build.mutation<
      ApiResponse<{ recoveryCodes: string[] }>,
      { code: string }
    >({
      invalidatesTags: ["CurrentUser"],
      query: (body) => ({ body, method: "POST", url: "/auth/2fa/email/activate" }),
    }),
    changePassword: build.mutation<
      { message: string },
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({ body, method: "POST", url: "/auth/password/change" }),
    }),
    disableTwoFactor: build.mutation<{ message: string }, { password: string }>({
      invalidatesTags: ["CurrentUser"],
      query: (body) => ({ body, method: "POST", url: "/auth/2fa/disable" }),
    }),
    confirmEmailChange: build.mutation<ApiResponse<CurrentUser>, { code: string }>({
      invalidatesTags: ["CurrentUser"],
      ...syncUser,
      query: (body) => ({ body, method: "POST", url: "/auth/profile/email/confirm" }),
    }),
    confirmPhoneChange: build.mutation<ApiResponse<CurrentUser>, { code: string }>({
      invalidatesTags: ["CurrentUser"],
      ...syncUser,
      query: (body) => ({ body, method: "POST", url: "/auth/profile/phone/confirm" }),
    }),
    forgotPassword: build.mutation<{ message: string }, { emailOrPhone: string }>({
      query: (body) => ({ body, method: "POST", url: "/auth/password/forgot" }),
    }),
    listSessions: build.query<ApiResponse<SessionView[]>, void>({
      providesTags: ["Sessions"],
      query: () => "/auth/sessions",
    }),
    requestEmailChange: build.mutation<
      ApiResponse<{ email: string; ttlMinutes: number }>,
      { email: string }
    >({
      query: (body) => ({ body, method: "POST", url: "/auth/profile/email/request" }),
    }),
    requestEmailTwoFactor: build.mutation<ApiResponse<{ emailMasked: string }>, void>({
      query: () => ({ method: "POST", url: "/auth/2fa/email/request" }),
    }),
    requestPhoneChange: build.mutation<
      ApiResponse<{ phone: string; ttlMinutes: number }>,
      { phone: string }
    >({
      query: (body) => ({ body, method: "POST", url: "/auth/profile/phone/request" }),
    }),
    resetPassword: build.mutation<
      { message: string },
      { newPassword: string; token: string }
    >({
      query: (body) => ({ body, method: "POST", url: "/auth/password/reset" }),
    }),
    revokeOtherSessions: build.mutation<ApiResponse<{ revoked: number }>, void>({
      invalidatesTags: ["Sessions"],
      query: () => ({ method: "DELETE", url: "/auth/sessions/others" }),
    }),
    revokeSession: build.mutation<ApiResponse<{ id: string }>, string>({
      invalidatesTags: ["Sessions"],
      query: (sessionId) => ({ method: "DELETE", url: `/auth/sessions/${sessionId}` }),
    }),
    updateProfile: build.mutation<
      ApiResponse<CurrentUser>,
      { firstName?: string; lastName?: string }
    >({
      invalidatesTags: ["CurrentUser"],
      ...syncUser,
      query: (body) => ({ body, method: "PATCH", url: "/auth/profile" }),
    }),
    updateProfilePicture: build.mutation<ApiResponse<CurrentUser>, FormData>({
      invalidatesTags: ["CurrentUser"],
      ...syncUser,
      query: (body) => ({ body, method: "PATCH", url: "/auth/profile/picture" }),
    }),
  }),
});

export const {
  useActivateEmailTwoFactorMutation,
  useChangePasswordMutation,
  useDisableTwoFactorMutation,
  useConfirmEmailChangeMutation,
  useConfirmPhoneChangeMutation,
  useForgotPasswordMutation,
  useListSessionsQuery,
  useRequestEmailChangeMutation,
  useRequestEmailTwoFactorMutation,
  useRequestPhoneChangeMutation,
  useResetPasswordMutation,
  useRevokeOtherSessionsMutation,
  useRevokeSessionMutation,
  useUpdateProfileMutation,
  useUpdateProfilePictureMutation,
} = profileApi;
