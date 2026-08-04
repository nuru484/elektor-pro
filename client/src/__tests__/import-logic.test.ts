// Voter import helpers: template shape, accepted files, and the summary line.
import { describe, expect, it } from "vitest";

import {
  buildTemplateCsv,
  isAcceptedImportFile,
  previewSummaryLine,
} from "@/components/voters/import-logic";

const preview = (total: number, valid: number) => ({
  errors: [],
  ignoredColumns: [],
  rows: [],
  summary: { invalid: total - valid, total, valid },
});

describe("voter import logic", () => {
  it("builds a template with the canonical headers and an example row", () => {
    const [header, example] = buildTemplateCsv().split("\n");
    expect(header).toBe("Full Name,Voter ID,Phone,Email");
    expect(example).toContain("STU1001");
  });

  it("accepts only csv and xlsx files, case-insensitively", () => {
    expect(isAcceptedImportFile("voters.csv")).toBe(true);
    expect(isAcceptedImportFile("VOTERS.XLSX")).toBe(true);
    expect(isAcceptedImportFile("voters.xls")).toBe(false);
    expect(isAcceptedImportFile("voters.pdf")).toBe(false);
  });

  it("summarizes a clean file and a partial file differently", () => {
    expect(previewSummaryLine(preview(10, 10))).toBe(
      "All 10 rows are ready to register.",
    );
    expect(previewSummaryLine(preview(14, 12))).toBe(
      "12 of 14 rows are ready; 2 need attention.",
    );
  });
});
