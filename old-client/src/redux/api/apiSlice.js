// src/redux/api/apiSlice.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/" }),
  tagTypes: [
    "Elections",
    "Election",
    "Voters",
    "Voter",
    "Candidates",
    "Candidate",
    "Portfolios",
    "Portfolio",
    "VoterElections",
    "Votes",
    "VoteActions",
    "ElectionResults",
    "Admins",
    "AuditTrail",
  ],
  endpoints: (builder) => ({
    getElections: builder.query({
      query: () => `elections`,
      providesTags: ["Elections"],
      keepUnusedDataFor: 300,
    }),

    getElection: builder.query({
      query: (id) => `elections/${id}`,
      providesTags: (result, error, id) => [
        { type: "Election", id },
        ...(result?.portfolios?.map((p) => ({ type: "Portfolio", id: p.id })) ||
          []),
        ...(result?.candidates?.map((c) => ({ type: "Candidate", id: c.id })) ||
          []),
        ...(result?.voterElections?.map((ve) => ({
          type: "VoterElection",
          id: ve.id,
        })) || []),
      ],
      keepUnusedDataFor: 300,
    }),

    updateElection: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `elections/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: [
        "Elections",
        "Portfolios",
        "Candidates",
        "VoterElections",
      ],
    }),

    deleteElection: builder.mutation({
      query: (id) => ({
        url: `elections/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        "Elections",
        "Portfolios",
        "Candidates",
        "VoterElections",
      ],
    }),

    createElection: builder.mutation({
      query: ({ ...data }) => ({
        url: `elections`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Elections"],
    }),

    uploadVoters: builder.mutation({
      query: (formData) => ({
        url: "upload-voters",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Voters", "VoterElections"],
    }),

    getVotersByElection: builder.query({
      query: (electionId) =>
        `voters${electionId ? `?electionId=${electionId}` : ""}`,
      providesTags: ["Voters", "VoterElections"],
      keepUnusedDataFor: 300,
    }),

    getVoter: builder.query({
      query: (id) => `voters/${id}`,
      providesTags: (result, error, id) => [
        { type: "Voter", id },
        ...(result?.voterElections?.map((ve) => ({
          type: "VoterElection",
          id: ve.id,
        })) || []),
      ],
      keepUnusedDataFor: 300,
    }),

    createVoter: builder.mutation({
      query: ({ ...data }) => ({
        url: `voters`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Voters", "VoterElections", "Votes", "VoteActions"],
    }),

    updateVoter: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `voters/${id}`,
        method: "PUT",
        body: data,
      }),
      async onQueryStarted({ id, ...data }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          apiSlice.util.updateQueryData("getVoter", id, (draft) => {
            Object.assign(draft, data);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: ["Voters", "VoterElections", "Votes", "VoteActions"],
    }),

    deleteVoter: builder.mutation({
      query: (id) => ({
        url: `voters/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Voters", "VoterElections", "Votes", "VoteActions"],
    }),

    getCandidatesByElection: builder.query({
      query: (electionId) =>
        `candidates${electionId ? `?electionId=${electionId}` : ""}`,
      providesTags: ["Candidates", "Portfolios"],
      keepUnusedDataFor: 300,
    }),

    getCandidate: builder.query({
      query: (id) => `candidates/${id}`,
      providesTags: (result, error, id) => [
        { type: "Candidate", id },
        ...(result?.votes?.map((v) => ({ type: "Votes", id: v.id })) || []),
        ...(result?.voteActions?.map((va) => ({
          type: "VoteActions",
          id: va.id,
        })) || []),
      ],
      keepUnusedDataFor: 300,
    }),

    createCandidate: builder.mutation({
      query: (formData) => ({
        url: `candidates`,
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Candidates", "Votes", "VoteActions"],
    }),

    updateCandidate: builder.mutation({
      query: ({ id, data }) => ({
        url: `candidates/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Candidates", "Votes", "VoteActions"],
    }),

    deleteCandidate: builder.mutation({
      query: (id) => ({
        url: `candidates/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Candidates", "Votes", "VoteActions"],
    }),

    getPortfoliosByElection: builder.query({
      query: (electionId) =>
        `portfolios${electionId ? `?electionId=${electionId}` : ""}`,
      providesTags: ["Portfolios"],
      keepUnusedDataFor: 300,
    }),

    getPortfolio: builder.query({
      query: (id) => `portfolios/${id}`,
      providesTags: (result, error, id) => [
        { type: "Portfolio", id },
        ...(result?.candidates?.map((c) => ({ type: "Candidate", id: c.id })) ||
          []),
        ...(result?.voteActions?.map((va) => ({
          type: "VoteActions",
          id: va.id,
        })) || []),
      ],
      keepUnusedDataFor: 300,
    }),

    createPortfolio: builder.mutation({
      query: ({ ...data }) => ({
        url: `portfolios`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Portfolios", "Candidates", "VoteActions"],
    }),

    updatePortfolio: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `portfolios/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: [
        "Portfolios",
        "Candidates",
        "Elections",
        "VoterElections",
        "Election",
        "Candidate",
        "VoteActions",
      ],
    }),

    deletePortfolio: builder.mutation({
      query: (id) => ({
        url: `portfolios/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Portfolios", "Candidates", "VoteActions"],
    }),

    vote: builder.mutation({
      query: ({ electionId, votes }) => ({
        url: `votes`,
        method: "POST",
        body: { electionId, votes },
      }),
      invalidatesTags: ["Votes", "VoterElections", "Candidates", "VoteActions"],
    }),

    getAuditLogs: builder.query({
      query: (electionId) => `audit-logs?electionId=${electionId}`,
      providesTags: ["VoteActions"],
      keepUnusedDataFor: 300,
    }),

    authUser: builder.query({
      query: () => `auth/user`,
      keepUnusedDataFor: 300,
    }),

    sendVoterOTP: builder.mutation({
      query: (voterId) => ({
        url: "voters/otp/send",
        method: "POST",
        body: { voterId },
      }),
    }),

    verifyVoterOTP: builder.mutation({
      query: ({ voterId, otp }) => ({
        url: "voters/otp/verify",
        method: "POST",
        body: { voterId, otp },
      }),
      invalidatesTags: ["Voters", "VoterElections"],
    }),

    getElectionResults: builder.query({
      query: (electionId) => `/results/${electionId}`,
      providesTags: (result, error, electionId) => [
        { type: "ElectionResults", id: electionId },
      ],
    }),
    getAdminDashboard: builder.query({
      query: () => `dashboards/admin`,
      providesTags: [
        "Elections",
        "Portfolios",
        "Candidates",
        "VoterElections",
        "Votes",
        "VoteActions",
      ],
      keepUnusedDataFor: 300,
    }),
    getVoterDashboard: builder.query({
      query: () => `dashboards/voter`,
      providesTags: ["Elections", "VoterElections", "Votes", "VoteActions"],
      keepUnusedDataFor: 300,
    }),
    getAdmins: builder.query({
      query: () => `admins`,
      providesTags: ["Admins"],
    }),
    getAdmin: builder.query({
      query: (id) => `admins/${id}`,
      providesTags: (result, error, id) => [{ type: "Admins", id }],
    }),
    createAdmin: builder.mutation({
      query: (data) => ({
        url: `admins`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Admins"],
    }),
    updateAdmin: builder.mutation({
      query: ({ id, data }) => ({
        url: `admins/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Admins", id },
        "Admins",
      ],
    }),
    deleteAdmin: builder.mutation({
      query: (id) => ({
        url: `admins/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Admins"],
    }),
    getAuditTrail: builder.query({
      query: (params) => {
        const queryString = params?.electionId
          ? `?electionId=${params.electionId}`
          : "";
        return `audit-trail${queryString}`;
      },
      providesTags: ["AuditTrail"],
      keepUnusedDataFor: 300,
    }),
  }),
});

export const {
  useGetElectionsQuery,
  useGetElectionQuery,
  useUpdateElectionMutation,
  useDeleteElectionMutation,
  useCreateElectionMutation,
  useUploadVotersMutation,
  useGetVotersByElectionQuery,
  useGetVoterQuery,
  useCreateVoterMutation,
  useUpdateVoterMutation,
  useDeleteVoterMutation,
  useGetCandidatesByElectionQuery,
  useGetCandidateQuery,
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
  useDeleteCandidateMutation,
  useGetPortfoliosByElectionQuery,
  useGetPortfolioQuery,
  useCreatePortfolioMutation,
  useUpdatePortfolioMutation,
  useDeletePortfolioMutation,
  useVoteMutation,
  useGetAuditLogsQuery,
  useAuthUserQuery,
  useSendVoterOTPMutation,
  useVerifyVoterOTPMutation,
  useGetElectionResultsQuery,
  useGetAdminDashboardQuery,
  useGetVoterDashboardQuery,
  useGetAdminsQuery,
  useGetAdminQuery,
  useCreateAdminMutation,
  useUpdateAdminMutation,
  useDeleteAdminMutation,
  useGetAuditTrailQuery,
} = apiSlice;
