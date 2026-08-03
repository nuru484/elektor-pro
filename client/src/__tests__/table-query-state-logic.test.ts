import { describe, expect, it } from "vitest";

import {
  buildTableQueryParams,
  DEFAULT_PAGE,
  filtersEqual,
  hasMeaningfulValue,
  isDefaultTableState,
  parseFiltersFromParams,
  parsePositiveIntParam,
  serializeTableState,
  type TableFiltersSpec,
} from "@/hooks/table-query-state-logic";

interface DemoFilters extends Record<string, boolean | number | string | undefined> {
  featured?: boolean;
  search?: string;
  status?: string;
}

const SPEC: TableFiltersSpec<DemoFilters> = {
  featured: { kind: "boolean", serializeFalse: true },
  search: { kind: "string" },
  status: { kind: "enum", values: ["DRAFT", "IN_PROGRESS", "ENDED"] },
};

describe("parsePositiveIntParam", () => {
  it("parses positive integers and rejects garbage", () => {
    expect(parsePositiveIntParam("3", 1)).toBe(3);
    expect(parsePositiveIntParam("0", 1)).toBe(1);
    expect(parsePositiveIntParam("-2", 1)).toBe(1);
    expect(parsePositiveIntParam("abc", 5)).toBe(5);
    expect(parsePositiveIntParam(null, 7)).toBe(7);
  });
});

describe("parseFiltersFromParams", () => {
  it("reads declared keys and drops invalid enum values", () => {
    const params = new URLSearchParams({ featured: "false", search: "sr", status: "HACKED" });
    const filters = parseFiltersFromParams<DemoFilters>(params, SPEC);
    expect(filters.search).toBe("sr");
    expect(filters.featured).toBe(false);
    expect(filters.status).toBeUndefined();
  });

  it("treats absent and empty params as undefined", () => {
    const filters = parseFiltersFromParams<DemoFilters>(new URLSearchParams({ search: "" }), SPEC);
    expect(filters.search).toBeUndefined();
    expect(filters.status).toBeUndefined();
  });
});

describe("hasMeaningfulValue", () => {
  it("rejects undefined and whitespace-only strings", () => {
    expect(hasMeaningfulValue(undefined)).toBe(false);
    expect(hasMeaningfulValue("   ")).toBe(false);
    expect(hasMeaningfulValue("x")).toBe(true);
    expect(hasMeaningfulValue(0)).toBe(true);
    expect(hasMeaningfulValue(false)).toBe(true);
  });
});

describe("serializeTableState", () => {
  it("always writes page/limit, filters only when meaningful", () => {
    const params = serializeTableState(2, 20, { search: "abc" } as DemoFilters, SPEC);
    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("20");
    expect(params.get("search")).toBe("abc");
    expect(params.get("status")).toBeNull();
  });

  it("keeps an explicit false only for serializeFalse fields", () => {
    const params = serializeTableState(1, 10, { featured: false } as DemoFilters, SPEC);
    expect(params.get("featured")).toBe("false");

    const noSerializeSpec: TableFiltersSpec<{ flag?: boolean }> = { flag: { kind: "boolean" } };
    const params2 = serializeTableState(1, 10, { flag: false }, noSerializeSpec);
    expect(params2.get("flag")).toBeNull();
  });
});

describe("filtersEqual / isDefaultTableState", () => {
  it("compares over the spec keys only", () => {
    expect(filtersEqual({ search: "a" } as DemoFilters, { search: "a" } as DemoFilters, SPEC)).toBe(true);
    expect(filtersEqual({ search: "a" } as DemoFilters, { search: "b" } as DemoFilters, SPEC)).toBe(false);
  });

  it("recognizes the untouched default state", () => {
    expect(isDefaultTableState(DEFAULT_PAGE, 10, {} as DemoFilters, SPEC, 10)).toBe(true);
    expect(isDefaultTableState(2, 10, {} as DemoFilters, SPEC, 10)).toBe(false);
    expect(isDefaultTableState(1, 10, { search: "x" } as DemoFilters, SPEC, 10)).toBe(false);
  });
});

describe("buildTableQueryParams", () => {
  it("strips empty values before they reach the API", () => {
    const params = buildTableQueryParams(1, 10, { search: "  ", status: "ENDED" } as DemoFilters);
    expect(params).toEqual({ limit: 10, page: 1, status: "ENDED" });
  });
});
