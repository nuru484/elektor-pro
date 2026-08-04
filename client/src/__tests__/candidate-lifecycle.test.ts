// Candidate lifecycle logic: the client mirror of the server's nomination
// state machine must offer only decisions the server will accept.
import { describe, expect, it } from "vitest";

import {
  CANDIDATE_STATUS_TRANSITIONS,
  DECISION_ACTIONS,
  legalCandidateDecisions,
} from "@/components/candidates/candidate-lifecycle";

describe("candidate lifecycle", () => {
  it("covers every status exactly once", () => {
    expect(Object.keys(CANDIDATE_STATUS_TRANSITIONS).sort()).toEqual([
      "DISQUALIFIED",
      "DRAFT",
      "QUALIFIED",
      "UNDER_REVIEW",
      "WITHDRAWN",
    ]);
  });

  it("mirrors the server's legal edges", () => {
    expect(legalCandidateDecisions("DRAFT")).toContain("UNDER_REVIEW");
    expect(legalCandidateDecisions("UNDER_REVIEW")).toEqual([
      "QUALIFIED",
      "DISQUALIFIED",
      "WITHDRAWN",
    ]);
    expect(legalCandidateDecisions("WITHDRAWN")).toEqual([]);
    expect(legalCandidateDecisions("DISQUALIFIED")).not.toContain("WITHDRAWN");
  });

  it("has an action label for every reachable decision", () => {
    const reachable = new Set(
      Object.values(CANDIDATE_STATUS_TRANSITIONS).flat(),
    );
    for (const status of reachable) {
      expect(DECISION_ACTIONS[status]).toBeTruthy();
    }
  });
});
