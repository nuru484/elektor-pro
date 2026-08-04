// src/redux/admin-api.ts — admin domain endpoints (elections, candidates,
// voters, change requests, dashboard, audit).
import type {
  ApiResponse,
  Candidate,
  ChangeRequest,
  DeletedRow,
  Election,
  ListQuery,
  PaginatedResponse,
  PermissionsMatrix,
  Portfolio,
  Voter,
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

export interface AuditLogRow {
  action: string;
  actor: null | { firstName: string; id: string; lastName: string; role: string };
  createdAt: string;
  entity: string;
  entityId: null | string;
  id: string;
  ipAddress: null | string;
  sequence: number;
  userAgent: null | string;
}

interface DashboardData {
  recentActivity: { action: string; createdAt: string; entity: string; id: string }[];
  recentElections: Election[];
  stats: {
    activeElections: number;
    pendingChanges: number;
    totalCandidates: number;
    totalElections: number;
    totalVoters: number;
  };
}

export const adminApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    approveChange: build.mutation<unknown, { id: string; note?: string }>({
      invalidatesTags: ["ChangeRequest", "Election", "Candidate", "Voter", "Dashboard"],
      query: ({ id, note }) => ({ body: { note }, method: "POST", url: `/change-requests/${id}/approve` }),
    }),
    createCandidate: build.mutation<unknown, Record<string, unknown>>({
      invalidatesTags: ["Candidate", "ChangeRequest", "Dashboard"],
      query: (body) => ({ body, method: "POST", url: "/candidates" }),
    }),
    createElection: build.mutation<unknown, Record<string, unknown>>({
      invalidatesTags: ["Election", "ChangeRequest", "Dashboard"],
      query: (body) => ({ body, method: "POST", url: "/elections" }),
    }),
    createPortfolio: build.mutation<unknown, Record<string, unknown>>({
      invalidatesTags: ["Portfolio", "ChangeRequest", "Election"],
      query: (body) => ({ body, method: "POST", url: "/portfolios" }),
    }),
    createVoter: build.mutation<unknown, Record<string, unknown>>({
      invalidatesTags: ["Voter", "ChangeRequest", "Dashboard"],
      query: (body) => ({ body, method: "POST", url: "/voters" }),
    }),
    listAuditLogs: build.query<
      PaginatedResponse<AuditLogRow>,
      ListQuery & { entity?: string; from?: string; to?: string }
    >({
      providesTags: ["AuditLog"],
      query: (params) => `/audit-logs${qs(params)}`,
    }),
    verifyAudit: build.query<ApiResponse<{ brokenAt?: number; total: number; valid: boolean }>, void>({
      query: () => "/audit-logs/verify",
    }),
    getDashboard: build.query<ApiResponse<DashboardData>, void>({
      providesTags: ["Dashboard"],
      query: () => "/dashboard/admin",
    }),
    getElection: build.query<ApiResponse<Election & { portfolios: Portfolio[] }>, string>({
      providesTags: ["Election"],
      query: (id) => `/elections/${id}`,
    }),
    listCandidates: build.query<PaginatedResponse<Candidate>, ListQuery & { electionId?: string }>({
      providesTags: ["Candidate"],
      query: (params) => `/candidates${qs(params)}`,
    }),
    cancelChange: build.mutation<unknown, { id: string }>({
      invalidatesTags: ["ChangeRequest"],
      query: ({ id }) => ({ method: "POST", url: `/change-requests/${id}/cancel` }),
    }),
    getChangeRequest: build.query<ApiResponse<ChangeRequest>, string>({
      providesTags: ["ChangeRequest"],
      query: (id) => `/change-requests/${id}`,
    }),
    getDeletedSummary: build.query<
      ApiResponse<{ count: number; resource: string }[]>,
      void
    >({
      providesTags: ["DeletedRecords"],
      query: () => "/admin/deleted",
    }),
    getPermissions: build.query<ApiResponse<PermissionsMatrix>, void>({
      providesTags: ["Permissions"],
      query: () => "/permissions",
    }),
    listChangeRequests: build.query<
      PaginatedResponse<ChangeRequest>,
      ListQuery & { entity?: string; from?: string; status?: string; to?: string }
    >({
      providesTags: ["ChangeRequest"],
      query: (params) => `/change-requests${qs(params)}`,
    }),
    listDeletedRecords: build.query<
      PaginatedResponse<DeletedRow>,
      ListQuery & { from?: string; resource: string; to?: string }
    >({
      providesTags: ["DeletedRecords"],
      query: ({ resource, ...params }) => `/admin/deleted/${resource}${qs(params)}`,
    }),
    purgeDeletedRecord: build.mutation<unknown, { id: string; resource: string }>({
      invalidatesTags: ["DeletedRecords"],
      query: ({ id, resource }) => ({
        method: "DELETE",
        url: `/admin/deleted/${resource}/${id}`,
      }),
    }),
    restoreDeletedRecord: build.mutation<unknown, { id: string; resource: string }>({
      // Restored rows reappear in their live lists - refresh them all.
      invalidatesTags: [
        "DeletedRecords",
        "Voter",
        "Election",
        "Candidate",
        "Portfolio",
        "Group",
        "GroupCategory",
        "StaffUser",
        "Dashboard",
      ],
      query: ({ id, resource }) => ({
        method: "POST",
        url: `/admin/deleted/${resource}/${id}/restore`,
      }),
    }),
    updateRolePermissions: build.mutation<
      unknown,
      { capabilities: string[]; role: string }
    >({
      invalidatesTags: ["Permissions", "CurrentUser"],
      query: ({ capabilities, role }) => ({
        body: { capabilities },
        method: "PUT",
        url: `/permissions/${role}`,
      }),
    }),
    listElections: build.query<PaginatedResponse<Election>, ListQuery & { status?: string }>({
      providesTags: ["Election"],
      query: (params) => `/elections${qs(params)}`,
    }),
    listVoters: build.query<PaginatedResponse<Voter>, ListQuery>({
      providesTags: ["Voter"],
      query: (params) => `/voters${qs(params)}`,
    }),
    rejectChange: build.mutation<unknown, { id: string; note?: string }>({
      invalidatesTags: ["ChangeRequest"],
      query: ({ id, note }) => ({ body: { note }, method: "POST", url: `/change-requests/${id}/reject` }),
    }),
    setElectionStatus: build.mutation<unknown, { id: string; status: string }>({
      invalidatesTags: ["Election", "ChangeRequest", "Dashboard"],
      query: ({ id, status }) => ({ body: { status }, method: "PATCH", url: `/elections/${id}/status` }),
    }),
  }),
});

export const {
  useApproveChangeMutation,
  useCancelChangeMutation,
  useCreateCandidateMutation,
  useCreateElectionMutation,
  useCreatePortfolioMutation,
  useCreateVoterMutation,
  useGetChangeRequestQuery,
  useGetDashboardQuery,
  useGetDeletedSummaryQuery,
  useGetElectionQuery,
  useGetPermissionsQuery,
  useListAuditLogsQuery,
  useListCandidatesQuery,
  useListChangeRequestsQuery,
  useListDeletedRecordsQuery,
  useListElectionsQuery,
  useListVotersQuery,
  usePurgeDeletedRecordMutation,
  useRejectChangeMutation,
  useRestoreDeletedRecordMutation,
  useSetElectionStatusMutation,
  useUpdateRolePermissionsMutation,
  useVerifyAuditQuery,
} = adminApi;
