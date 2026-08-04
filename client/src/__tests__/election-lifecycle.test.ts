// Election lifecycle logic: the client-side mirror of the backend state
// machine must offer only transitions the server will accept.
import { describe, expect, it } from "vitest";

import {
  ELECTION_STATUS_TRANSITIONS,
  legalNextStatuses,
  statusLabel,
} from "@/components/elections/election-lifecycle";

describe("election lifecycle", () => {
  it("covers every status exactly once", () => {
    expect(Object.keys(ELECTION_STATUS_TRANSITIONS).sort()).toEqual([
      "ARCHIVED",
      "CANCELLED",
      "DRAFT",
      "ENDED",
      "IN_PROGRESS",
      "PAUSED",
      "SCHEDULED",
    ]);
  });

  it("mirrors the backend's legal edges", () => {
    expect(legalNextStatuses("DRAFT")).toEqual(["SCHEDULED", "CANCELLED"]);
    expect(legalNextStatuses("IN_PROGRESS")).toEqual(["PAUSED", "ENDED"]);
    expect(legalNextStatuses("ENDED")).toEqual(["ARCHIVED"]);
    expect(legalNextStatuses("ARCHIVED")).toEqual([]);
  });

  it("never offers a self-transition or an illegal jump", () => {
    for (const [from, targets] of Object.entries(ELECTION_STATUS_TRANSITIONS)) {
      expect(targets).not.toContain(from);
    }
    expect(legalNextStatuses("DRAFT")).not.toContain("ENDED");
    expect(legalNextStatuses("ENDED")).not.toContain("DRAFT");
  });

  it("labels statuses for humans", () => {
    expect(statusLabel("IN_PROGRESS")).toBe("IN PROGRESS");
    expect(statusLabel("DRAFT")).toBe("DRAFT");
  });
});
