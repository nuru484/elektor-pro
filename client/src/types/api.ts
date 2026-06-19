// src/types/api.ts — shared API contract types (mirror the backend envelope).

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: true;
}

export interface PaginationMeta {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  message: string;
  meta: PaginationMeta;
  success: true;
}

export interface ListQuery {
  limit?: number;
  page?: number;
  search?: string;
}

export type Role = "ADMIN" | "AGENT" | "CANDIDATE" | "SUPER_ADMIN" | "VOTER";
export type Status = "ACTIVE" | "INACTIVE" | "LOCKED" | "SUSPENDED";
export type ElectionStatus =
  | "ARCHIVED"
  | "CANCELLED"
  | "DRAFT"
  | "ENDED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "SCHEDULED";
export type VotingMethod = "MULTI_SELECT" | "SINGLE_CHOICE" | "YES_NO";
export type ChangeStatus =
  | "APPLIED"
  | "APPROVED"
  | "CANCELLED"
  | "FAILED"
  | "PENDING"
  | "REJECTED";

export interface CurrentUser {
  email: null | string;
  firstName: string;
  id: string;
  lastName: string;
  phone: null | string;
  profilePicture?: null | string;
  role: Role;
  status: Status;
  twoFactorEnabled: boolean;
}

export interface Election {
  _count?: { candidates: number; portfolios: number; voterElections: number };
  certifiedAt: null | string;
  description: null | string;
  endDate: string;
  id: string;
  name: string;
  resultsPolicy: string;
  resultsPublishedAt: null | string;
  slug: string;
  startDate: string;
  status: ElectionStatus;
}

export interface Candidate {
  id: string;
  manifesto?: null | string;
  name: string;
  party: null | string;
  portfolio?: { id: string; name: string };
  portfolioId?: string;
  profilePicture: null | string;
}

export interface Portfolio {
  _count?: { candidates: number };
  candidates?: Candidate[];
  description: null | string;
  eligibility: string;
  id: string;
  maxSelections: number;
  name: string;
  votingMethod: VotingMethod;
}

export interface Voter {
  groupMemberships?: { group: { id: string; name: string } }[];
  id: string;
  name: string;
  phoneNumber: null | string;
  voterId: string;
}

export interface ChangeRequest {
  action: string;
  createdAt: string;
  entity: string;
  id: string;
  requestedBy?: { firstName: string; lastName: string };
  status: ChangeStatus;
  summary: null | string;
}

export interface CandidateResult {
  id: string;
  name: string;
  party: null | string;
  percentage: number;
  votes: number;
}

export interface PortfolioResult {
  abstain: number;
  candidates: CandidateResult[];
  id: string;
  name: string;
  skip: number;
  totalVotes: number;
  votingMethod: string;
  winner: CandidateResult | null;
}

export interface ElectionResults {
  election: Election;
  portfolios: PortfolioResult[];
  turnout: { percentage: number; totalEligible: number; totalVoted: number };
}
