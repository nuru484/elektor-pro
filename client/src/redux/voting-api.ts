// src/redux/voting-api.ts - voter OTP, ballot, results, and integrity endpoints.
import type {
  ApiResponse,
  ChainVerification,
  ElectionResults,
  MyCandidacy,
  PaginatedResponse,
  Portfolio,
  ReceiptVerification,
} from "@/types/api";

/** Search + period + page params for the personal console lists. */
export interface PersonalListParams {
  from?: string;
  limit?: number;
  page?: number;
  search?: string;
  to?: string;
}

const personalQs = (params: PersonalListParams): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
};

import { apiSlice } from "./api-slice";

interface VoterBallot {
  accreditationRequired: boolean;
  accredited: boolean;
  election: {
    description: null | string;
    id: string;
    name: string;
    /** Admin presentation choices (e.g. ballotLayout: "list" | "grid"). */
    settings?: null | Record<string, unknown>;
    slug: string;
  };
  hasVoted: boolean;
  portfolios: (Portfolio & { candidates: NonNullable<Portfolio["candidates"]> })[];
  /**
   * Open ballot: this election records what the voter voted against their
   * name. Shown on the ballot BEFORE they cast - consent to an open ballot
   * only means something if it is informed.
   */
  voteVisibleToVoter: boolean;
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

/** One entry from the voter's own voting history. */
export interface VoterHistoryItem {
  /**
   * What they voted. Present ONLY for open-ballot elections
   * (voteVisibleToVoter). A secret ballot stores no link from a voter to
   * their ballot, so there is nothing to replay.
   */
  choices:
    | null
    | {
        approve: boolean | null;
        candidate: null | { name: string; profilePicture: null | string };
        portfolio: { name: string };
        type: "ABSTAIN" | "SKIP" | "VOTE";
      }[];
  election: {
    endDate: string;
    id: string;
    name: string;
    resultsPolicy: string;
    resultsPublishedAt: null | string;
    slug: string;
    startDate: string;
    status: string;
    /** Open ballot: this election records what each voter voted. */
    voteVisibleToVoter: boolean;
  };
  /** Their receipt, kept only for open-ballot elections. */
  receiptCode: null | string;
  votedAt: null | string;
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
    listVoterElections: build.query<
      PaginatedResponse<VoterElectionItem>,
      PersonalListParams
    >({
      query: (params) => `/voter/elections${personalQs(params)}`,
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
    getVoterHistory: build.query<
      PaginatedResponse<VoterHistoryItem>,
      PersonalListParams
    >({
      query: (params) => `/voter/history${personalQs(params)}`,
    }),
    getMyCandidacies: build.query<
      PaginatedResponse<MyCandidacy>,
      PersonalListParams
    >({
      providesTags: ["Candidate"],
      query: (params) => `/my/candidacies${personalQs(params)}`,
    }),
  }),
});

export const {
  useCastBallotMutation,
  useCodeLoginMutation,
  useGetMyCandidaciesQuery,
  useGetResultsQuery,
  useGetVoterBallotQuery,
  useGetVoterHistoryQuery,
  useLazyVerifyReceiptQuery,
  useListVoterElectionsQuery,
  useRequestOtpMutation,
  useVerifyChainQuery,
  useVerifyOtpMutation,
} = votingApi;
