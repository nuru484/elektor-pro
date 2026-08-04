// src/redux/governance-api.ts — staff accounts, agent assignments, capability
// grants, groups/categories, and the organization settings.
import type {
  AccessGrant,
  AgentAssignment,
  AgentDashboardRow,
  ApiResponse,
  Group,
  GroupCategory,
  ListQuery,
  Organization,
  PaginatedResponse,
  StaffUser,
} from "@/types/api";

import { apiSlice } from "./api-slice";

const qs = (params: object): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : "";
};

type DateWindow = { from?: string; to?: string };

export const governanceApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    assignAgent: build.mutation<
      unknown,
      { candidateId?: string; electionId: string; userId: string }
    >({
      invalidatesTags: ["Agents"],
      query: (body) => ({ body, method: "POST", url: "/agents" }),
    }),
    createGroup: build.mutation<unknown, Record<string, unknown>>({
      invalidatesTags: ["Group", "ChangeRequest"],
      query: (body) => ({ body, method: "POST", url: "/groups" }),
    }),
    createGroupCategory: build.mutation<unknown, Record<string, unknown>>({
      invalidatesTags: ["GroupCategory", "ChangeRequest"],
      query: (body) => ({ body, method: "POST", url: "/group-categories" }),
    }),
    createStaffUser: build.mutation<unknown, FormData | Record<string, unknown>>({
      invalidatesTags: ["StaffUser"],
      query: (body) => ({ body, method: "POST", url: "/staff-users" }),
    }),
    deleteGroup: build.mutation<unknown, string>({
      invalidatesTags: ["Group", "ChangeRequest"],
      query: (id) => ({ method: "DELETE", url: `/groups/${id}` }),
    }),
    deleteGroupCategory: build.mutation<unknown, string>({
      invalidatesTags: ["GroupCategory", "Group", "ChangeRequest"],
      query: (id) => ({ method: "DELETE", url: `/group-categories/${id}` }),
    }),
    deleteStaffUser: build.mutation<unknown, string>({
      invalidatesTags: ["StaffUser"],
      query: (id) => ({ method: "DELETE", url: `/users/${id}` }),
    }),
    getAgentDashboard: build.query<ApiResponse<AgentDashboardRow[]>, void>({
      providesTags: ["Dashboard"],
      query: () => "/dashboard/agent",
    }),
    confirmUserContact: build.mutation<unknown, { code: string; id: string }>({
      invalidatesTags: ["StaffUser", "Agents"],
      query: ({ code, id }) => ({
        body: { code },
        method: "POST",
        url: `/users/${id}/contact/confirm`,
      }),
    }),
    getStaffUser: build.query<ApiResponse<StaffUser>, string>({
      providesTags: ["StaffUser"],
      query: (id) => `/users/${id}`,
    }),
    getOrganization: build.query<ApiResponse<Organization>, void>({
      providesTags: ["Organization"],
      query: () => "/organization",
    }),
    grantCapability: build.mutation<
      unknown,
      { capability: string; electionId?: string; expiresAt?: string; userId: string }
    >({
      invalidatesTags: ["Grants", "CurrentUser"],
      query: (body) => ({ body, method: "POST", url: "/grants" }),
    }),
    listAgents: build.query<
      PaginatedResponse<AgentAssignment>,
      DateWindow & ListQuery & { electionId?: string }
    >({
      providesTags: ["Agents"],
      query: (params) => `/agents${qs(params)}`,
    }),
    listGrants: build.query<
      PaginatedResponse<AccessGrant>,
      DateWindow & ListQuery & { capability?: string }
    >({
      providesTags: ["Grants"],
      query: (params) => `/grants${qs(params)}`,
    }),
    listGroupCategories: build.query<PaginatedResponse<GroupCategory>, ListQuery>({
      providesTags: ["GroupCategory"],
      query: (params) => `/group-categories${qs(params)}`,
    }),
    listGroups: build.query<
      PaginatedResponse<Group>,
      ListQuery & { categoryId?: string }
    >({
      providesTags: ["Group"],
      query: (params) => `/groups${qs(params)}`,
    }),
    listStaffUsers: build.query<
      PaginatedResponse<StaffUser>,
      DateWindow & ListQuery & { role?: string; status?: string }
    >({
      providesTags: ["StaffUser"],
      query: (params) => `/staff-users${qs(params)}`,
    }),
    requestUserContact: build.mutation<
      unknown,
      { email?: string; id: string; phone?: string }
    >({
      query: ({ email, id, phone }) => ({
        body: { email, phone },
        method: "POST",
        url: `/users/${id}/contact/request`,
      }),
    }),
    removeAgent: build.mutation<unknown, string>({
      invalidatesTags: ["Agents"],
      query: (id) => ({ method: "DELETE", url: `/agents/${id}` }),
    }),
    revokeGrant: build.mutation<unknown, string>({
      invalidatesTags: ["Grants", "CurrentUser"],
      query: (id) => ({ method: "DELETE", url: `/grants/${id}` }),
    }),
    unlockUser: build.mutation<unknown, string>({
      invalidatesTags: ["StaffUser"],
      query: (id) => ({ method: "POST", url: `/auth/users/${id}/unlock` }),
    }),
    updateGroup: build.mutation<unknown, { data: Record<string, unknown>; id: string }>({
      invalidatesTags: ["Group", "ChangeRequest"],
      query: ({ data, id }) => ({ body: data, method: "PATCH", url: `/groups/${id}` }),
    }),
    updateGroupCategory: build.mutation<
      unknown,
      { data: Record<string, unknown>; id: string }
    >({
      invalidatesTags: ["GroupCategory", "Group", "ChangeRequest"],
      query: ({ data, id }) => ({
        body: data,
        method: "PATCH",
        url: `/group-categories/${id}`,
      }),
    }),
    updateOrganization: build.mutation<unknown, Record<string, unknown>>({
      invalidatesTags: ["Organization", "ChangeRequest"],
      query: (body) => ({ body, method: "PATCH", url: "/organization" }),
    }),
    updateOrganizationImage: build.mutation<
      ApiResponse<Organization>,
      { field: "favicon" | "logo"; file: File }
    >({
      invalidatesTags: ["Organization"],
      query: ({ field, file }) => {
        const body = new FormData();
        body.append("image", file);
        return { body, method: "PATCH", url: `/organization/${field}` };
      },
    }),
    updateUserContact: build.mutation<
      unknown,
      { email?: string; id: string; phone?: string }
    >({
      invalidatesTags: ["StaffUser", "Agents"],
      query: ({ email, id, phone }) => ({
        body: { email, phone },
        method: "PATCH",
        url: `/users/${id}/contact`,
      }),
    }),
    updateStaffUser: build.mutation<
      unknown,
      { data: Record<string, unknown>; id: string }
    >({
      invalidatesTags: ["StaffUser"],
      query: ({ data, id }) => ({ body: data, method: "PATCH", url: `/users/${id}` }),
    }),
    updateUserRole: build.mutation<unknown, { id: string; role: string }>({
      invalidatesTags: ["StaffUser"],
      query: ({ id, role }) => ({
        body: { role },
        method: "PATCH",
        url: `/users/${id}/role`,
      }),
    }),
  }),
});

export const {
  useAssignAgentMutation,
  useConfirmUserContactMutation,
  useCreateGroupCategoryMutation,
  useCreateGroupMutation,
  useCreateStaffUserMutation,
  useDeleteGroupCategoryMutation,
  useDeleteGroupMutation,
  useDeleteStaffUserMutation,
  useGetAgentDashboardQuery,
  useGetOrganizationQuery,
  useGetStaffUserQuery,
  useGrantCapabilityMutation,
  useListAgentsQuery,
  useListGrantsQuery,
  useListGroupCategoriesQuery,
  useListGroupsQuery,
  useListStaffUsersQuery,
  useRemoveAgentMutation,
  useRequestUserContactMutation,
  useRevokeGrantMutation,
  useUnlockUserMutation,
  useUpdateGroupCategoryMutation,
  useUpdateGroupMutation,
  useUpdateOrganizationImageMutation,
  useUpdateOrganizationMutation,
  useUpdateStaffUserMutation,
  useUpdateUserContactMutation,
  useUpdateUserRoleMutation,
} = governanceApi;
