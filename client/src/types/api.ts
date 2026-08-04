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

export type Role = "ACCREDITOR" | "ADMIN" | "AGENT" | "CANDIDATE" | "SUPER_ADMIN" | "VOTER";
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

export type TwoFactorMethod = "EMAIL" | "TOTP";

export type Capability =
  | "ACCREDIT_VOTERS"
  | "APPROVE_CHANGES"
  | "CERTIFY_RESULTS"
  | "MANAGE_AGENTS"
  | "MANAGE_CANDIDATES"
  | "MANAGE_ELECTIONS"
  | "MANAGE_GROUPS"
  | "MANAGE_ORGANIZATION"
  | "MANAGE_PORTFOLIOS"
  | "MANAGE_VOTERS"
  | "VIEW_RESULTS";

export interface CurrentUser {
  /** Effective capabilities (runtime role matrix + global grants). */
  capabilities?: Capability[];
  email: null | string;
  firstName: string;
  id: string;
  lastLoginAt?: null | string;
  lastName: string;
  /** Admin-created account that must set its own password before use. */
  mustChangePassword?: boolean;
  phone: null | string;
  profilePicture?: null | string;
  role: Role;
  status: Status;
  twoFactorEnabled: boolean;
  twoFactorMethod?: null | TwoFactorMethod;
}

export interface CapabilityMeta {
  capability: Capability;
  description: string;
  label: string;
}

export interface CapabilityGroup {
  capabilities: CapabilityMeta[];
  group: string;
}

export interface PermissionsMatrix {
  catalog: CapabilityGroup[];
  editableRoles: Role[];
  matrix: Record<string, Capability[]>;
}

/** A soft-deleted row from the deleted-records manager. */
export interface DeletedRow {
  createdAt: string;
  deletedAt: string;
  id: string;
  label: string;
  meta: null | string;
}

export interface Organization {
  accentColor: string;
  faviconUrl: null | string;
  id: string;
  locale: string;
  logoUrl: null | string;
  name: string;
  primaryColor: string;
  slug: string;
  supportEmail: null | string;
  supportPhone: null | string;
  timezone: string;
  website: null | string;
}

export interface StaffUser {
  createdAt: string;
  creator?: null | { firstName: string; id: string; lastName: string };
  lastLoginAt?: null | string;
  mustChangePassword?: boolean;
  profilePicture?: null | string;
  email: null | string;
  firstName: string;
  id: string;
  lastName: string;
  lockedAt: null | string;
  phone: null | string;
  role: Role;
  status: Status;
  twoFactorEnabled: boolean;
}

export interface GroupCategory {
  _count?: { groups: number };
  allowMultiple: boolean;
  code: string;
  description: null | string;
  id: string;
  name: string;
  order: number;
}

export interface Group {
  _count?: { voterMemberships: number };
  category?: { id: string; name: string };
  categoryId: string;
  code: string;
  description: null | string;
  id: string;
  name: string;
  parent?: null | { id: string; name: string };
}

export interface AgentAssignment {
  candidate: null | { id: string; name: string };
  createdAt: string;
  election: { id: string; name: string };
  id: string;
  user: { email: null | string; firstName: string; id: string; lastName: string };
}

export interface AccessGrant {
  capability: Capability;
  createdAt: string;
  election: null | { id: string; name: string };
  expiresAt: null | string;
  id: string;
  user: { email: null | string; firstName: string; id: string; lastName: string };
}

/** One assignment row from the agent's own dashboard. */
export interface AgentDashboardRow {
  candidate: null | { id: string; name: string };
  election: { id: string; name: string; slug: string; status: ElectionStatus };
  id: string;
}

/** A signed-in device from GET /auth/sessions. */
export interface SessionView {
  createdAt: string;
  current: boolean;
  id: string;
  ipAddress: null | string;
  lastUsedAt: string;
  userAgent: null | string;
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
  createdAt?: string;
  election?: { id: string; name: string; slug?: string };
  id: string;
  manifesto?: null | string;
  manifestoUrl?: null | string;
  name: string;
  nickname: null | string;
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
  createdAt?: string;
  email?: null | string;
  groupMemberships?: { group: { id: string; name: string } }[];
  id: string;
  name: string;
  phoneNumber: null | string;
  profilePicture?: null | string;
  voterId: string;
}

export interface ChangeRequest {
  action: string;
  appliedAt?: null | string;
  createdAt: string;
  entity: string;
  entityId?: null | string;
  error?: null | string;
  id: string;
  payload?: Record<string, unknown>;
  requestedBy?: { firstName: string; lastName: string };
  requestedById?: string;
  reviewedAt?: null | string;
  reviewedBy?: null | { firstName: string; lastName: string };
  reviewNote?: null | string;
  status: ChangeStatus;
  summary: null | string;
}

export interface CandidateResult {
  id: string;
  name: string;
  nickname: null | string;
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
