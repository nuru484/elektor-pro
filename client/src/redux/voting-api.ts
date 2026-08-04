// src/redux/voting-api.ts - voter OTP, ballot, results, and integrity endpoints.
import type {
  ApiResponse,
  ChainVerification,
  ElectionResults,
  MyCandidacy,
  Portfolio,
  ReceiptVerification,
} from "@/types/api";

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
  accreditationRequired: boolean;
  description: null | string;
  endDate: string;
  id: string;
  name: string;
  resultsPolicy: string;
  resultsPublishedAt: null | string;
  slug: string;
  startDate: string;
  status: string;
  voterElections: {
    accreditedAt: null | string;
    hasVoted: boolean;
    isEligible: boolean;
  }[];
}

export type { VoterElectionItem };

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
    codeLogin: build.mutation<
      ApiResponse<{ voterId: string }>,
      { code: string; voterId: string }
    >({
      query: (body) => ({ body, method: "POST", url: "/voter/code-login" }),
    }),
    verifyReceipt: build.query<
      ApiResponse<ReceiptVerification>,
      { code: string; electionId: string }
    >({
      query: ({ code, electionId }) => `/elections/${electionId}/receipts/${code}`,
    }),
    verifyChain: build.query<ApiResponse<ChainVerification>, string>({
      // Fresh verification every visit: this is the integrity check itself.
      keepUnusedDataFor: 0,
      query: (idOrSlug) => `/elections/${idOrSlug}/ballots/verify`,
    }),
    getMyCandidacies: build.query<ApiResponse<MyCandidacy[]>, void>({
      providesTags: ["Candidate"],
      query: () => "/my/candidacies",
    }),
  }),
});

export const {
  useCastBallotMutation,
  useCodeLoginMutation,
  useGetMyCandidaciesQuery,
  useGetResultsQuery,
  useGetVoterBallotQuery,
  useLazyVerifyReceiptQuery,
  useListVoterElectionsQuery,
  useRequestOtpMutation,
  useVerifyChainQuery,
  useVerifyOtpMutation,
} = votingApi;
