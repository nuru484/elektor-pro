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
export type EligibilityMode = "ALL_VOTERS" | "GROUPS" | "ROLL";
export type CandidateStatus =
  | "DISQUALIFIED"
  | "DRAFT"
  | "QUALIFIED"
  | "UNDER_REVIEW"
  | "WITHDRAWN";
export type PortfolioEligibilityMode = "ALL_OF_GROUPS" | "ALL_VOTERS" | "ANY_OF_GROUPS";
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
  | "VET_CANDIDATES"
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
  user: {
    email: null | string;
    firstName: string;
    id: string;
    lastName: string;
    phone?: null | string;
  };
}

/** A background results export (POST /elections/:id/results/export). */
export interface ExportJobStatus {
  byteSize: null | number;
  completedAt: null | string;
  downloadToken: string;
  error: null | string;
  expiresAt: string;
  fileName: null | string;
  format: "CSV" | "PDF";
  id: string;
  status: "FAILED" | "PENDING" | "PROCESSING" | "READY";
}

/**
 * The 202 that starts an export. `queued` is false when the server has no
 * queue configured, in which case it rendered inline and the file is already
 * collectable.
 */
export interface ExportJobCreated {
  downloadToken: string;
  expiresAt: string;
  format: "CSV" | "PDF";
  id: string;
  queued: boolean;
  status: string;
}

/** Progress of a queued import (GET /import-batches/:id). */
export interface ImportBatchStatus {
  completedAt: null | string;
  createdRows: number;
  error: null | string;
  errors: null | { message: string; row: number }[];
  failedRows: number;
  id: string;
  kind: string;
  processedRows: number;
  status: "COMPLETED" | "FAILED" | "PARTIAL" | "PENDING" | "PROCESSING";
  totalRows: number;
}

/**
 * A bulk import response. Large imports come back 202 with a batch to poll;
 * small ones keep the maker-checker shape (`pending` when staged for
 * approval), so callers must handle both.
 */
export interface BulkImportResponse {
  data?: { id: string; queued: boolean; totalRows: number };
  message?: string;
  pending?: boolean;
}

/** An accreditor's permission to work one election's desk. */
export interface AccreditorAssignment {
  createdAt: string;
  election: {
    endDate: string;
    id: string;
    name: string;
    startDate: string;
    status: string;
  };
  id: string;
  user: {
    email: null | string;
    firstName: string;
    id: string;
    lastName: string;
    phone?: null | string;
    profilePicture?: null | string;
  };
}

/** An election an accreditor may run the desk for. */
export interface DeskElection {
  accreditationRequired: boolean;
  endDate: string;
  id: string;
  name: string;
  resultsPolicy?: string;
  resultsPublishedAt?: null | string;
  slug: string;
  startDate: string;
  status: string;
  voteCodeEnabled: boolean;
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
  candidate: null | {
    account?: null | { email: null | string; phone: null | string };
    ballotNumber: null | number;
    id: string;
    manifesto?: null | string;
    name: string;
    nickname: null | string;
    portfolio: { id: string; name: string };
    profilePicture: null | string;
    status: CandidateStatus;
  };
  election: {
    _count?: { candidates: number; portfolios: number; voterElections: number };
    eligibilityGroups?: {
      group: { category?: { name: string }; id: string; name: string };
    }[];
    eligibilityMode?: EligibilityMode;
    endDate: string;
    id: string;
    name: string;
    resultsPolicy?: string;
    resultsPublishedAt?: null | string;
    slug: string;
    startDate: string;
    status: ElectionStatus;
  };
  id: string;
}

/**
 * An agent's console payload. One live posting at a time (the server refuses
 * a second), so `current` is a single row rather than a list; everything
 * whose election has finished is history.
 */
export interface AgentDashboardData {
  current: AgentDashboardRow | null;
  history: AgentDashboardRow[];
}

/** An accreditor's console payload: the desk they staff now, plus past ones. */
export interface DeskAssignments {
  current: (DeskElection & { assignedAt: string }) | null;
  history: (DeskElection & { assignedAt: string })[];
  /** Staff are not posted to one desk: they get every open election here. */
  staffElections?: DeskElection[];
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
  accreditationRequired?: boolean;
  certifiedAt: null | string;
  description: null | string;
  /** Groups that may see and vote in this election (GROUPS mode). */
  eligibilityGroups?: { group: { category?: { name: string }; id: string; name: string } }[];
  eligibilityMode?: EligibilityMode;
  endDate: string;
  id: string;
  /** Set on certification; a locked election refuses content changes. */
  isLocked?: boolean;
  name: string;
  resultsPolicy: string;
  resultsPublishedAt: null | string;
  /** Per-election customization JSON (e.g. resultsVisibleToRoles). */
  settings?: null | Record<string, unknown>;
  slug: string;
  startDate: string;
  status: ElectionStatus;
  /** When on, candidates pass vetting before reaching the ballot. */
  vettingEnabled?: boolean;
  /** Auto-decision threshold percent; null = manual decisions. */
  vettingPassPercent?: null | number;
  /** Accreditation hands each voter a one-time sign-in code. */
  voteCodeEnabled?: boolean;
  /**
   * Open ballot. Stores each voter's receipt against their record so they can
   * review what they voted - which also makes the election non-secret.
   */
  voteVisibleToVoter?: boolean;
}

/** One row from the accreditation desk's voter search. */
export interface AccreditationSearchRow {
  accreditedAt: null | string;
  codeIssued: boolean;
  eligible: boolean;
  hasVoted: boolean;
  id: string;
  name: string;
  phoneNumber: null | string;
  profilePicture: null | string;
  voterId: string;
}

/** GET /elections/:id/turnout. */
export interface ElectionTurnout {
  accredited: number;
  election: { id: string; name: string };
  eligible: number;
  percentage: number;
  voted: number;
}

export interface Candidate {
  /** List payloads carry contact only; the detail payload adds identity. */
  account?: null | {
    email: null | string;
    firstName?: string;
    id?: string;
    lastName?: string;
    phone?: null | string;
  };
  ballotNumber?: null | number;
  createdAt?: string;
  election?: {
    id: string;
    name: string;
    slug?: string;
    vettingEnabled?: boolean;
    vettingPassPercent?: null | number;
  };
  id: string;
  manifesto?: null | string;
  manifestoUrl?: null | string;
  name: string;
  nickname: null | string;
  /** The same person's candidacies in other elections (via linked account). */
  otherCandidacies?: {
    election: { id: string; name: string; status: ElectionStatus };
    id: string;
    portfolio: { name: string };
    status: CandidateStatus;
  }[];
  portfolio?: { id: string; name: string };
  portfolioId?: string;
  profilePicture: null | string;
  reviewedAt?: null | string;
  reviewedBy?: null | { firstName: string; id: string; lastName: string };
  status?: CandidateStatus;
  vettingNote?: null | string;
}

export interface VettingCriterion {
  _count?: { scores: number };
  description: null | string;
  id: string;
  maxScore: number;
  name: string;
  order: number;
}

export interface VettingScoreRow {
  criterionId: string;
  id: string;
  note: null | string;
  score: number;
  scoredBy: null | { firstName: string; id: string; lastName: string };
  updatedAt: string;
}

/** GET /candidates/:id/vetting - criteria with averages + the grand total. */
/** One of the signed-in candidate's own candidacies (candidate console). */
export interface MyCandidacy {
  ballotNumber: null | number;
  election: {
    endDate: string;
    id: string;
    name: string;
    resultsPolicy: string;
    resultsPublishedAt: null | string;
    slug: string;
    startDate: string;
    status: ElectionStatus;
    vettingEnabled: boolean;
    vettingPassPercent: null | number;
  };
  id: string;
  manifesto: null | string;
  name: string;
  nickname: null | string;
  portfolio: {
    /** Everyone contesting this portfolio (the candidate's rivals). */
    candidates?: {
      ballotNumber: null | number;
      id: string;
      name: string;
      nickname: null | string;
      profilePicture: null | string;
      status: CandidateStatus;
    }[];
    id: string;
    name: string;
  };
  profilePicture: null | string;
  reviewedAt: null | string;
  status: CandidateStatus;
  vettingNote: null | string;
}

/** One-page election report for staff (turnout, pipeline, integrity). */
export interface ElectionReport {
  accredited: number;
  candidates: Record<string, number>;
  chain: ChainVerification;
  portfolios: number;
  turnout: ElectionTurnout;
}

/** Whole-chain ballot verification outcome (public integrity check). */
export interface ChainVerification {
  brokenAt?: number;
  electionId: string;
  total: number;
  valid: boolean;
}

/** A certified results snapshot: the hash is the official fingerprint. */
export interface CertificationSnapshot {
  certifiedBy: null | { firstName: string; id: string; lastName: string };
  createdAt: string;
  hash: string;
  id: string;
}

/** A verified ballot receipt: proof the vote was recorded as cast. */
export interface ReceiptVerification {
  castAt: string;
  choices: {
    approve: boolean | null;
    candidate: null | string;
    portfolio: string;
    type: "ABSTAIN" | "SKIP" | "VOTE";
  }[];
  /** Whether the stored ballot hash still recomputes (chain-intact). */
  integrityValid: boolean;
  receiptCode: string;
  sequence: number;
}

export interface CandidateVetting {
  byCriterion: {
    average: null | number;
    criterion: VettingCriterion;
    scores: VettingScoreRow[];
  }[];
  candidateId: string;
  maxTotal: number;
  total: number;
}

export interface Portfolio {
  _count?: { candidates: number };
  allowAbstain?: boolean;
  candidates?: Candidate[];
  description: null | string;
  eligibility: PortfolioEligibilityMode | string;
  eligibilityGroups?: { group: { id: string; name: string } }[];
  id: string;
  maxSelections: number;
  name: string;
  order?: number;
  votingMethod: VotingMethod;
}

/** One VoterElection row from an election's roll. */
export interface RollEntry {
  accreditedAt: null | string;
  createdAt: string;
  hasVoted: boolean;
  id: string;
  isEligible: boolean;
  votedAt: null | string;
  voter: {
    email: null | string;
    groupMemberships?: { group: { id: string; name: string } }[];
    id: string;
    name: string;
    phoneNumber: null | string;
    profilePicture: null | string;
    voterId: string;
  };
}

/** Per-row problem reported by the voter import preview. */
export interface ImportRowError {
  field: string;
  message: string;
  /** 1-based data row number (header excluded). */
  row: number;
}

/** A clean, importable voter row (matches POST /voters/bulk). */
export interface ImportVoterRow {
  email?: string;
  name: string;
  phoneNumber?: string;
  voterId: string;
}

export interface ImportPreview {
  errors: ImportRowError[];
  ignoredColumns: string[];
  rows: ImportVoterRow[];
  summary: { invalid: number; total: number; valid: number };
}

/** A clean, importable nomination (matches POST /candidates/bulk rows). */
export interface ImportCandidateRow {
  electionId: string;
  manifesto?: string;
  name: string;
  nickname?: string;
  partySymbol?: string;
  portfolioId: string;
  /** Resolved portfolio name, for the preview display. */
  portfolioName: string;
}

export interface CandidateImportPreview {
  errors: ImportRowError[];
  ignoredColumns: string[];
  rows: ImportCandidateRow[];
  summary: { invalid: number; total: number; valid: number };
}

export interface Voter {
  createdAt?: string;
  email?: null | string;
  groupMemberships?: {
    group: { category?: { name: string }; id: string; name: string };
  }[];
  id: string;
  name: string;
  phoneNumber: null | string;
  profilePicture?: null | string;
  voterId: string;
  /** The elections this voter is registered in, newest first. */
  voterElections?: {
    accreditedAt: null | string;
    election: { id: string; name: string; slug: string; status: ElectionStatus };
    hasVoted: boolean;
    isEligible: boolean;
  }[];
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
  /** YES_NO portfolios only. */
  approveVotes?: number;
  ballotNumber?: null | number;
  id: string;
  name: string;
  nickname: null | string;
  percentage: number;
  profilePicture?: null | string;
  /** YES_NO portfolios only. */
  rejectVotes?: number;
  votes: number;
}

export interface PortfolioResult {
  abstain: number;
  candidates: CandidateResult[];
  id: string;
  /** True when the top score is shared - there is no winner until resolved. */
  isTied: boolean;
  name: string;
  skip: number;
  /** Everyone level on the top score when it is contested; else empty. */
  tiedCandidates: CandidateResult[];
  totalVotes: number;
  votingMethod: string;
  /** Null while a race is tied: a tie has no winner, it has a decision to make. */
  winner: CandidateResult | null;
}

export interface ElectionResults {
  election: Election;
  portfolios: PortfolioResult[];
  turnout: { percentage: number; totalEligible: number; totalVoted: number };
}
