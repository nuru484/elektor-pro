// src/redux/admin-api.ts — admin domain endpoints (elections, candidates,
// voters, change requests, dashboard, audit).
import type {
  ApiResponse,
  Candidate,
  ChangeRequest,
  Election,
  ListQuery,
  PaginatedResponse,
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
    listChangeRequests: build.query<PaginatedResponse<ChangeRequest>, ListQuery & { status?: string }>({
      providesTags: ["ChangeRequest"],
      query: (params) => `/change-requests${qs(params)}`,
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
  useCreateCandidateMutation,
  useCreateElectionMutation,
  useCreatePortfolioMutation,
  useGetDashboardQuery,
  useGetElectionQuery,
  useListCandidatesQuery,
  useListChangeRequestsQuery,
  useListElectionsQuery,
  useListVotersQuery,
  useRejectChangeMutation,
  useSetElectionStatusMutation,
} = adminApi;
