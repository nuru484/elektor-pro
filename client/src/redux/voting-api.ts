// src/redux/voting-api.ts — voter OTP, ballot, and results endpoints.
import type { ApiResponse, ElectionResults, Portfolio } from "@/types/api";

import { apiSlice } from "./api-slice";

interface VoterBallot {
  accreditationRequired: boolean;
  accredited: boolean;
  election: { description: null | string; id: string; name: string; slug: string };
  hasVoted: boolean;
  portfolios: (Portfolio & { candidates: NonNullable<Portfolio["candidates"]> })[];
}

interface BallotSelection {
  approve?: boolean;
  candidateIds?: string[];
  portfolioId: string;
  type?: "ABSTAIN" | "SKIP" | "VOTE";
}

interface VoterElectionItem {
  description: null | string;
  id: string;
  name: string;
  slug: string;
  status: string;
  voterElections: { hasVoted: boolean }[];
}

export const votingApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    castBallot: build.mutation<
      ApiResponse<{ receiptCode: string }>,
      { electionId: string; selections: BallotSelection[] }
    >({
      query: ({ electionId, selections }) => ({
        body: { selections },
        method: "POST",
        url: `/voter/elections/${electionId}/ballot`,
      }),
    }),
    getResults: build.query<ApiResponse<ElectionResults>, string>({
      providesTags: ["Results"],
      query: (electionId) => `/elections/${electionId}/results`,
    }),
    getVoterBallot: build.query<ApiResponse<VoterBallot>, string>({
      query: (electionId) => `/voter/elections/${electionId}/ballot`,
    }),
    listVoterElections: build.query<ApiResponse<VoterElectionItem[]>, void>({
      query: () => "/voter/elections",
    }),
    requestOtp: build.mutation<
      ApiResponse<{
        channel: "email" | "sms";
        destinationMasked: string;
        devCode?: string;
        expiresInMinutes: number;
      }>,
      { identifier: string }
    >({
      query: (body) => ({ body, method: "POST", url: "/voter/otp/request" }),
    }),
    verifyOtp: build.mutation<
      ApiResponse<{ voterId: string }>,
      { code: string; identifier: string }
    >({
      query: (body) => ({ body, method: "POST", url: "/voter/otp/verify" }),
    }),
    verifyReceipt: build.query<ApiResponse<unknown>, { code: string; electionId: string }>({
      query: ({ code, electionId }) => `/elections/${electionId}/receipts/${code}`,
    }),
  }),
});

export const {
  useCastBallotMutation,
  useGetResultsQuery,
  useGetVoterBallotQuery,
  useLazyVerifyReceiptQuery,
  useListVoterElectionsQuery,
  useRequestOtpMutation,
  useVerifyOtpMutation,
} = votingApi;
