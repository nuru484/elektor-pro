import { describe, expect, it } from "vitest";

import {
  clearAllFiltersPatch,
  hasActiveTableFilters,
  tableEmptyMode,
} from "@/components/ui/table-empty-logic";

describe("hasActiveTableFilters", () => {
  it("ignores undefined/empty values", () => {
    expect(hasActiveTableFilters({ a: undefined, b: "", c: "  " })).toBe(false);
    expect(hasActiveTableFilters({ a: "x" })).toBe(true);
    expect(hasActiveTableFilters({ a: false })).toBe(true);
  });
});

describe("tableEmptyMode", () => {
  it("is null while loading or with rows", () => {
    expect(tableEmptyMode(true, 0, false)).toBeNull();
    expect(tableEmptyMode(false, 3, true)).toBeNull();
  });

  it("distinguishes a truly empty table from a filtered miss", () => {
    expect(tableEmptyMode(false, 0, false)).toBe("no-data");
    expect(tableEmptyMode(false, 0, true)).toBe("filtered-empty");
  });
});

describe("clearAllFiltersPatch", () => {
  it("produces an all-undefined patch over the current keys", () => {
    expect(clearAllFiltersPatch({ search: "x", status: "ENDED" })).toEqual({
      search: undefined,
      status: undefined,
    });
  });
});
