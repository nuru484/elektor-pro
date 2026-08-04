// src/redux/admin-api.ts — admin domain endpoints (elections, candidates,
// voters, change requests, dashboard, audit).
import type {
  AccreditationSearchRow,
  ApiResponse,
  Candidate,
  CandidateImportPreview,
  CandidateVetting,
  ChangeRequest,
  DeletedRow,
  Election,
  ElectionTurnout,
  ImportCandidateRow,
  ImportPreview,
  ImportVoterRow,
  ListQuery,
  PaginatedResponse,
  PermissionsMatrix,
  Portfolio,
  RollEntry,
  Voter,
  VettingCriterion,
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
    createCandidate: build.mutation<unknown, FormData | Record<string, unknown>>({
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
    createVoter: build.mutation<unknown, FormData | Record<string, unknown>>({
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
    deleteVoter: build.mutation<unknown, string>({
      invalidatesTags: ["Voter", "ChangeRequest", "Dashboard"],
      query: (id) => ({ method: "DELETE", url: `/voters/${id}` }),
    }),
    deleteCandidate: build.mutation<unknown, string>({
      invalidatesTags: ["Candidate", "ChangeRequest", "Dashboard"],
      query: (id) => ({ method: "DELETE", url: `/candidates/${id}` }),
    }),
    updateVoter: build.mutation<unknown, { data: Record<string, unknown>; id: string }>({
      invalidatesTags: ["Voter", "ChangeRequest"],
      query: ({ data, id }) => ({ body: data, method: "PATCH", url: `/voters/${id}` }),
    }),
    updateCandidate: build.mutation<
      unknown,
      { data: Record<string, unknown>; id: string }
    >({
      invalidatesTags: ["Candidate", "ChangeRequest"],
      query: ({ data, id }) => ({ body: data, method: "PATCH", url: `/candidates/${id}` }),
    }),
    updateVoterPicture: build.mutation<unknown, { file: File; id: string }>({
      invalidatesTags: ["Voter"],
      query: ({ file, id }) => {
        const body = new FormData();
        body.append("image", file);
        return { body, method: "PATCH", url: `/voters/${id}/picture` };
      },
    }),
    updateCandidateManifesto: build.mutation<unknown, { file: File; id: string }>({
      invalidatesTags: ["Candidate"],
      query: ({ file, id }) => {
        const body = new FormData();
        body.append("manifestoPdf", file);
        return { body, method: "PATCH", url: `/candidates/${id}/manifesto` };
      },
    }),
    updateCandidatePicture: build.mutation<unknown, { file: File; id: string }>({
      invalidatesTags: ["Candidate"],
      query: ({ file, id }) => {
        const body = new FormData();
        body.append("image", file);
        return { body, method: "PATCH", url: `/candidates/${id}/picture` };
      },
    }),
    getCandidate: build.query<ApiResponse<Candidate>, string>({
      providesTags: ["Candidate"],
      query: (id) => `/candidates/${id}`,
    }),
    getVoter: build.query<ApiResponse<Voter>, string>({
      providesTags: ["Voter"],
      query: (id) => `/voters/${id}`,
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
    listVoters: build.query<
      PaginatedResponse<Voter>,
      ListQuery & { excludeElectionId?: string; groupId?: string }
    >({
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
    updateElection: build.mutation<unknown, { data: Record<string, unknown>; id: string }>({
      invalidatesTags: ["Election", "ChangeRequest", "Dashboard"],
      query: ({ data, id }) => ({ body: data, method: "PATCH", url: `/elections/${id}` }),
    }),
    deleteElection: build.mutation<unknown, string>({
      invalidatesTags: ["Election", "ChangeRequest", "Dashboard"],
      query: (id) => ({ method: "DELETE", url: `/elections/${id}` }),
    }),
    listPortfolios: build.query<PaginatedResponse<Portfolio>, ListQuery & { electionId?: string }>({
      providesTags: ["Portfolio"],
      query: (params) => `/portfolios${qs(params)}`,
    }),
    updatePortfolio: build.mutation<unknown, { data: Record<string, unknown>; id: string }>({
      // Election: the workspace header counts portfolios.
      invalidatesTags: ["Portfolio", "ChangeRequest", "Election"],
      query: ({ data, id }) => ({ body: data, method: "PATCH", url: `/portfolios/${id}` }),
    }),
    deletePortfolio: build.mutation<unknown, string>({
      invalidatesTags: ["Portfolio", "ChangeRequest", "Election"],
      query: (id) => ({ method: "DELETE", url: `/portfolios/${id}` }),
    }),
    listRoll: build.query<
      PaginatedResponse<RollEntry>,
      ListQuery & {
        accredited?: string;
        electionId: string;
        eligible?: string;
        voted?: string;
      }
    >({
      providesTags: ["Roll"],
      query: ({ electionId, ...params }) => `/elections/${electionId}/roll${qs(params)}`,
    }),
    addToRoll: build.mutation<
      ApiResponse<{
        added: number;
        alreadyEligible: number;
        joinedGroup: number;
        reEnabled: number;
      }>,
      {
        electionId: string;
        groupId?: string;
        joinGroupId?: string;
        voterIds?: string[];
      }
    >({
      // Election: roll size shows on the workspace overview. Voter: joining a
      // group changes memberships on voter lists/profiles.
      invalidatesTags: ["Roll", "Election", "Voter"],
      query: ({ electionId, ...body }) => ({
        body,
        method: "POST",
        url: `/elections/${electionId}/roll`,
      }),
    }),
    setRollEligibility: build.mutation<
      unknown,
      { electionId: string; isEligible: boolean; voterId: string }
    >({
      invalidatesTags: ["Roll"],
      query: ({ electionId, isEligible, voterId }) => ({
        body: { isEligible },
        method: "PATCH",
        url: `/elections/${electionId}/roll/${voterId}`,
      }),
    }),
    removeFromRoll: build.mutation<unknown, { electionId: string; voterId: string }>({
      invalidatesTags: ["Roll", "Election"],
      query: ({ electionId, voterId }) => ({
        method: "DELETE",
        url: `/elections/${electionId}/roll/${voterId}`,
      }),
    }),
    previewVoterImport: build.mutation<ApiResponse<ImportPreview>, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return { body, method: "POST", url: "/voters/import/preview" };
      },
    }),
    bulkCreateVoters: build.mutation<unknown, { voters: ImportVoterRow[] }>({
      invalidatesTags: ["Voter", "ChangeRequest", "Dashboard"],
      query: (body) => ({ body, method: "POST", url: "/voters/bulk" }),
    }),
    previewCandidateImport: build.mutation<
      ApiResponse<CandidateImportPreview>,
      { electionId: string; file: File }
    >({
      query: ({ electionId, file }) => {
        const body = new FormData();
        body.append("electionId", electionId);
        body.append("file", file);
        return { body, method: "POST", url: "/candidates/import/preview" };
      },
    }),
    bulkCreateCandidates: build.mutation<unknown, { candidates: ImportCandidateRow[] }>({
      // Election: the workspace header counts candidates.
      invalidatesTags: ["Candidate", "ChangeRequest", "Dashboard", "Election"],
      query: (body) => ({ body, method: "POST", url: "/candidates/bulk" }),
    }),
    searchAccreditation: build.query<
      ApiResponse<AccreditationSearchRow[]>,
      { electionId: string; query: string }
    >({
      // Desk lookups must reflect the latest check-ins, not a cache.
      keepUnusedDataFor: 0,
      query: ({ electionId, query }) =>
        `/elections/${electionId}/accreditation/search${qs({ query })}`,
    }),
    accreditVoter: build.mutation<
      ApiResponse<{ accreditedAt: string; voteCode?: string }>,
      { electionId: string; voterId: string }
    >({
      invalidatesTags: ["Roll"],
      query: ({ electionId, voterId }) => ({
        method: "POST",
        url: `/elections/${electionId}/voters/${voterId}/accredit`,
      }),
    }),
    revokeAccreditation: build.mutation<
      unknown,
      { electionId: string; voterId: string }
    >({
      invalidatesTags: ["Roll"],
      query: ({ electionId, voterId }) => ({
        method: "DELETE",
        url: `/elections/${electionId}/voters/${voterId}/accredit`,
      }),
    }),
    getTurnout: build.query<ApiResponse<ElectionTurnout>, string>({
      providesTags: ["Roll"],
      query: (electionId) => `/elections/${electionId}/turnout`,
    }),
    listCriteria: build.query<ApiResponse<VettingCriterion[]>, string>({
      providesTags: ["Vetting"],
      query: (electionId) => `/elections/${electionId}/vetting/criteria`,
    }),
    createCriterion: build.mutation<
      unknown,
      { data: Record<string, unknown>; electionId: string }
    >({
      invalidatesTags: ["Vetting"],
      query: ({ data, electionId }) => ({
        body: data,
        method: "POST",
        url: `/elections/${electionId}/vetting/criteria`,
      }),
    }),
    updateCriterion: build.mutation<unknown, { data: Record<string, unknown>; id: string }>({
      invalidatesTags: ["Vetting"],
      query: ({ data, id }) => ({
        body: data,
        method: "PATCH",
        url: `/vetting/criteria/${id}`,
      }),
    }),
    deleteCriterion: build.mutation<unknown, string>({
      invalidatesTags: ["Vetting"],
      query: (id) => ({ method: "DELETE", url: `/vetting/criteria/${id}` }),
    }),
    getCandidateVetting: build.query<ApiResponse<CandidateVetting>, string>({
      providesTags: ["Vetting"],
      query: (candidateId) => `/candidates/${candidateId}/vetting`,
    }),
    scoreCandidate: build.mutation<
      unknown,
      { candidateId: string; criterionId: string; note?: string; score: number }
    >({
      invalidatesTags: ["Vetting"],
      query: ({ candidateId, ...body }) => ({
        body,
        method: "PUT",
        url: `/candidates/${candidateId}/vetting/score`,
      }),
    }),
    decideCandidate: build.mutation<
      unknown,
      { candidateId: string; note?: string; status: string }
    >({
      invalidatesTags: ["Candidate", "Vetting", "Dashboard"],
      query: ({ candidateId, ...body }) => ({
        body,
        method: "POST",
        url: `/candidates/${candidateId}/status`,
      }),
    }),
    setBallotNumber: build.mutation<
      unknown,
      { ballotNumber: null | number; candidateId: string }
    >({
      invalidatesTags: ["Candidate"],
      query: ({ ballotNumber, candidateId }) => ({
        body: { ballotNumber },
        method: "PATCH",
        url: `/candidates/${candidateId}/ballot-number`,
      }),
    }),
    autoAssignBallotNumbers: build.mutation<
      ApiResponse<{ assigned: number }>,
      { electionId: string; strategy: "ALPHABETICAL" | "SCORE" }
    >({
      invalidatesTags: ["Candidate"],
      query: ({ electionId, strategy }) => ({
        body: { strategy },
        method: "POST",
        url: `/elections/${electionId}/ballot-numbers/auto`,
      }),
    }),
  }),
});

export const {
  useAccreditVoterMutation,
  useAddToRollMutation,
  useApproveChangeMutation,
  useAutoAssignBallotNumbersMutation,
  useBulkCreateCandidatesMutation,
  useBulkCreateVotersMutation,
  useCancelChangeMutation,
  useCreateCriterionMutation,
  useCreateCandidateMutation,
  useCreateElectionMutation,
  useCreatePortfolioMutation,
  useCreateVoterMutation,
  useDecideCandidateMutation,
  useDeleteCandidateMutation,
  useDeleteCriterionMutation,
  useDeleteElectionMutation,
  useDeletePortfolioMutation,
  useDeleteVoterMutation,
  useGetCandidateQuery,
  useGetCandidateVettingQuery,
  useGetChangeRequestQuery,
  useGetVoterQuery,
  useGetDashboardQuery,
  useGetDeletedSummaryQuery,
  useGetElectionQuery,
  useGetPermissionsQuery,
  useGetTurnoutQuery,
  useListAuditLogsQuery,
  useListCandidatesQuery,
  useListChangeRequestsQuery,
  useListCriteriaQuery,
  useListDeletedRecordsQuery,
  useListElectionsQuery,
  useListPortfoliosQuery,
  useListRollQuery,
  useListVotersQuery,
  usePreviewCandidateImportMutation,
  usePreviewVoterImportMutation,
  usePurgeDeletedRecordMutation,
  useRejectChangeMutation,
  useRemoveFromRollMutation,
  useRestoreDeletedRecordMutation,
  useRevokeAccreditationMutation,
  useScoreCandidateMutation,
  useSearchAccreditationQuery,
  useSetBallotNumberMutation,
  useSetElectionStatusMutation,
  useSetRollEligibilityMutation,
  useUpdateCandidateManifestoMutation,
  useUpdateCandidateMutation,
  useUpdateCandidatePictureMutation,
  useUpdateCriterionMutation,
  useUpdateElectionMutation,
  useUpdatePortfolioMutation,
  useUpdateRolePermissionsMutation,
  useUpdateVoterMutation,
  useUpdateVoterPictureMutation,
  useVerifyAuditQuery,
} = adminApi;
