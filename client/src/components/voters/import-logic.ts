// src/components/voters/import-logic.ts
// Pure helpers for the voter import flow (kept out of the page so they are
// unit-testable).
import type { ImportPreview } from "@/types/api";

/**
 * The voter template admins download. Name and Voter ID are required; the
 * second example row shows the optional columns (Phone, Email) left empty.
 * Headers must stay canonical - the parser matches them by name.
 */
export const buildTemplateCsv = (): string =>
  [
    "Full Name,Voter ID,Phone,Email",
    "Ama Mensah,STU1001,+233550000000,ama@example.com",
    "Kofi Boadu,STU1002,,",
  ].join("\n");

/**
 * The candidate template: portfolio is matched by name within the election.
 * Candidate and Portfolio are required; the second example row shows the
 * optional columns (Nickname, Party Symbol, Manifesto) left empty.
 */
// Email/Phone: at least one per row - it becomes the candidate's sign-in
// account (the server refuses rows with neither).
export const buildCandidateTemplateCsv = (): string =>
  [
    "Candidate,Portfolio,Email,Phone,Nickname,Party Symbol,Manifesto",
    "Efua Owusu,President,efua@example.com,+233240000001,The Builder,Rising Sun,Better welfare for every member",
    "Kwame Asante,President,,+233240000002,,,",
  ].join("\n");

/** Accepted upload extensions (mirrors the backend's parser). */
export const ACCEPTED_IMPORT_EXTENSIONS = [".csv", ".xlsx"] as const;

export const isAcceptedImportFile = (filename: string): boolean =>
  ACCEPTED_IMPORT_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));

/** One-line human summary of a preview, e.g. "12 of 14 rows ready". */
export const previewSummaryLine = (preview: ImportPreview): string => {
  const { invalid, total, valid } = preview.summary;
  if (invalid === 0) return `All ${String(total)} rows are ready to register.`;
  return `${String(valid)} of ${String(total)} rows are ready; ${String(invalid)} need attention.`;
};
