// src/components/elections/election-lifecycle.ts
// Pure election lifecycle knowledge, mirroring the backend state machine in
// src/services/domain/election.service.ts - the UI offers only transitions
// the server will accept.
import type { ElectionStatus, EligibilityMode } from "@/types/api";

export const ELECTION_STATUS_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  ARCHIVED: [],
  CANCELLED: ["ARCHIVED"],
  DRAFT: ["SCHEDULED", "CANCELLED"],
  ENDED: ["ARCHIVED"],
  IN_PROGRESS: ["PAUSED", "ENDED"],
  PAUSED: ["IN_PROGRESS", "ENDED", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "DRAFT", "CANCELLED"],
};

export const statusLabel = (status: string): string => status.replaceAll("_", " ");

/** The statuses an election may move to from where it is now. */
export const legalNextStatuses = (current: ElectionStatus): ElectionStatus[] =>
  ELECTION_STATUS_TRANSITIONS[current];

export const ELIGIBILITY_MODE_LABELS: Record<EligibilityMode, string> = {
  ALL_VOTERS: "All registered voters",
  GROUPS: "Specific groups",
  ROLL: "Managed roll",
};

/** One-line explanation shown under the eligibility mode. */
export const ELIGIBILITY_MODE_HINTS: Record<EligibilityMode, string> = {
  ALL_VOTERS: "Every registered voter can see and vote in this election.",
  GROUPS:
    "Only voters in the selected groups can see or vote in this election.",
  ROLL: "Only voters explicitly added to the roll can see or vote.",
};
