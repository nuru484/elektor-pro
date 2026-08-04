// src/components/candidates/candidate-lifecycle.ts
// Client mirror of the server's nomination lifecycle map (vetting.service.ts)
// so the UI offers only decisions the server will accept.
import type { CandidateStatus } from "@/types/api";

export const CANDIDATE_STATUS_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  DISQUALIFIED: ["QUALIFIED", "UNDER_REVIEW"],
  DRAFT: ["UNDER_REVIEW", "QUALIFIED", "DISQUALIFIED", "WITHDRAWN"],
  QUALIFIED: ["UNDER_REVIEW", "DISQUALIFIED", "WITHDRAWN"],
  UNDER_REVIEW: ["QUALIFIED", "DISQUALIFIED", "WITHDRAWN"],
  WITHDRAWN: [],
};

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  DISQUALIFIED: "Disqualified",
  DRAFT: "Draft",
  QUALIFIED: "Qualified",
  UNDER_REVIEW: "Under review",
  WITHDRAWN: "Withdrawn",
};

/** Action phrasing for decision buttons/confirmations. */
export const DECISION_ACTIONS: Partial<Record<CandidateStatus, string>> = {
  DISQUALIFIED: "Disqualify",
  QUALIFIED: "Qualify",
  UNDER_REVIEW: "Send to review",
  WITHDRAWN: "Withdraw",
};

export const legalCandidateDecisions = (current: CandidateStatus): CandidateStatus[] =>
  CANDIDATE_STATUS_TRANSITIONS[current];
