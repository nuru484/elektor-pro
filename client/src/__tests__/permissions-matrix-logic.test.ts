import { describe, expect, it } from "vitest";

import {
  buildMatrixState,
  changedRoles,
  hasCapabilityIn,
  toggleCapability,
} from "@/components/console/permissions-matrix-logic";

import type { Capability } from "@/types/api";

const SAVED: Record<string, Capability[]> = {
  ADMIN: ["MANAGE_ELECTIONS", "MANAGE_VOTERS"],
  AGENT: ["VIEW_RESULTS"],
  CANDIDATE: [],
};

describe("permissions matrix logic", () => {
  it("copies the saved matrix defensively", () => {
    const state = buildMatrixState(SAVED);
    expect(state.ADMIN).toEqual(["MANAGE_ELECTIONS", "MANAGE_VOTERS"]);
    expect(state.ADMIN).not.toBe(SAVED.ADMIN);
  });

  it("toggles a capability on and off without mutating", () => {
    const state = buildMatrixState(SAVED);
    const on = toggleCapability(state, "AGENT", "ACCREDIT_VOTERS");
    expect(hasCapabilityIn(on, "AGENT", "ACCREDIT_VOTERS")).toBe(true);
    expect(hasCapabilityIn(state, "AGENT", "ACCREDIT_VOTERS")).toBe(false);

    const off = toggleCapability(on, "AGENT", "ACCREDIT_VOTERS");
    expect(hasCapabilityIn(off, "AGENT", "ACCREDIT_VOTERS")).toBe(false);
  });

  it("reports only genuinely changed roles, order-insensitively", () => {
    const state = buildMatrixState(SAVED);
    expect(changedRoles(SAVED, state)).toEqual([]);

    // Same grants, different order - not a change.
    const reordered = {
      ...state,
      ADMIN: ["MANAGE_VOTERS", "MANAGE_ELECTIONS"] as Capability[],
    };
    expect(changedRoles(SAVED, reordered)).toEqual([]);

    const edited = toggleCapability(state, "CANDIDATE", "VIEW_RESULTS");
    expect(changedRoles(SAVED, edited)).toEqual(["CANDIDATE"]);
  });

  it("treats unknown roles as empty", () => {
    expect(hasCapabilityIn({}, "ADMIN", "VIEW_RESULTS")).toBe(false);
  });
});
