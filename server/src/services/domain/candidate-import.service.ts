// src/services/domain/candidate-import.service.ts
//
// Candidate file import, preview-first and election-scoped: parse a CSV/XLSX
// of nominations, resolve each row's portfolio by name against the election's
// portfolios, validate, and report per-row problems WITHOUT writing. The
// client submits the clean rows through POST /candidates/bulk, so writes stay
// transactional and maker-checker governed. Photos and manifesto PDFs cannot
// ride a spreadsheet; they are added per candidate afterwards.
import { z } from 'zod';

import prisma from '../../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../../middlewares/error-handler.js';
import { type ImportRowError, parseRecords } from './voter-import.service.js';

export const MAX_CANDIDATE_IMPORT_ROWS = 1000;

export interface CandidateImportPreview {
  errors: ImportRowError[];
  ignoredColumns: string[];
  rows: ImportCandidateRow[];
  summary: { invalid: number; total: number; valid: number };
}

/** A clean, importable nomination (matches POST /candidates/bulk rows). */
export interface ImportCandidateRow {
  electionId: string;
  email?: string;
  manifesto?: string;
  name: string;
  nickname?: string;
  partySymbol?: string;
  phone?: string;
  portfolioId: string;
  /** Resolved from the portfolio column; used for the preview display. */
  portfolioName: string;
}

const HEADER_ALIASES: Record<string, string> = {
  alias: 'nickname',
  campaignname: 'nickname',
  candidate: 'name',
  candidatename: 'name',
  email: 'email',
  emailaddress: 'email',
  fullname: 'name',
  manifesto: 'manifesto',
  mobile: 'phone',
  name: 'name',
  nickname: 'nickname',
  office: 'portfolio',
  partysymbol: 'partySymbol',
  phone: 'phone',
  phonenumber: 'phone',
  portfolio: 'portfolio',
  position: 'portfolio',
  symbol: 'partySymbol',
};

const canonicalHeader = (raw: string): null | string =>
  HEADER_ALIASES[raw.toLowerCase().replaceAll(/[\s_-]/g, '')] ?? null;

// Mirrors the bulk-create contract: every nomination needs a contact so a
// sign-in account can be created for the candidate.
const rowSchema = z
  .object({
    email: z.email('Not a valid email').optional(),
    manifesto: z.string().max(5000).optional(),
    name: z.string().min(1, 'Name is required').max(150),
    nickname: z.string().max(120).optional(),
    partySymbol: z.string().max(300).optional(),
    phone: z.string().min(6).max(20).optional(),
    portfolio: z.string().min(1, 'Portfolio is required').max(150),
  })
  .refine((d) => Boolean(d.email) || Boolean(d.phone), {
    message: 'An email or phone number is required so the candidate can sign in',
    path: ['email'],
  });

/**
 * Parse + validate an uploaded nominations file for one election. Pure
 * preview: no writes.
 */
export const previewCandidateImport = async (
  electionId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string },
): Promise<CandidateImportPreview> => {
  const election = await prisma.election.findFirst({
    select: { id: true },
    where: { id: electionId },
  });
  if (!election) throw new NotFoundError('Election not found');

  const [records, portfolios, existing] = await Promise.all([
    parseRecords(file),
    prisma.portfolio.findMany({
      select: { id: true, name: true },
      where: { electionId },
    }),
    prisma.candidate.findMany({
      select: { name: true, portfolioId: true },
      where: { electionId },
    }),
  ]);
  if (records.length === 0) {
    throw new BadRequestError('The file has no data rows', {
      code: 'EMPTY_IMPORT_FILE',
      layer: 'candidate-import',
    });
  }
  if (records.length > MAX_CANDIDATE_IMPORT_ROWS) {
    throw new BadRequestError(
      `The file has ${String(records.length)} rows; the limit per import is ${String(MAX_CANDIDATE_IMPORT_ROWS)}`,
      { code: 'IMPORT_TOO_LARGE', layer: 'candidate-import' },
    );
  }

  const ignoredColumns: string[] = [];
  const mapping = new Map<string, string>();
  for (const rawHeader of Object.keys(records[0])) {
    const canonical = canonicalHeader(rawHeader);
    if (canonical) mapping.set(rawHeader, canonical);
    else ignoredColumns.push(rawHeader);
  }
  const mapped = new Set(mapping.values());
  if (!mapped.has('name') || !mapped.has('portfolio')) {
    throw new BadRequestError(
      'Could not find the required columns: the file needs a candidate name column and a portfolio column',
      { code: 'MISSING_IMPORT_COLUMNS', layer: 'candidate-import' },
    );
  }
  if (!mapped.has('email') && !mapped.has('phone')) {
    throw new BadRequestError(
      'The file needs an email or phone column - candidates sign in with their contact details',
      { code: 'MISSING_IMPORT_COLUMNS', layer: 'candidate-import' },
    );
  }

  const portfolioByName = new Map(
    portfolios.map((p) => [p.name.trim().toLowerCase(), p]),
  );
  const taken = new Set(
    existing.map((c) => `${c.portfolioId}:${c.name.trim().toLowerCase()}`),
  );

  const errors: ImportRowError[] = [];
  const rows: ImportCandidateRow[] = [];
  const seenInFile = new Set<string>();

  records.forEach((record, index) => {
    const rowNumber = index + 1;
    const candidate: Record<string, string> = {};
    for (const [rawHeader, canonical] of mapping) {
      const value = (record[rawHeader] ?? '').trim();
      if (value) candidate[canonical] = value;
    }
    const parsed = rowSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          field: issue.path.join('.') || 'row',
          message: issue.message,
          row: rowNumber,
        });
      }
      return;
    }

    const portfolio = portfolioByName.get(parsed.data.portfolio.trim().toLowerCase());
    if (!portfolio) {
      errors.push({
        field: 'portfolio',
        message: `No portfolio named "${parsed.data.portfolio}" exists in this election`,
        row: rowNumber,
      });
      return;
    }

    const key = `${portfolio.id}:${parsed.data.name.trim().toLowerCase()}`;
    if (seenInFile.has(key)) {
      errors.push({
        field: 'name',
        message: 'Duplicate nomination for this portfolio in the file',
        row: rowNumber,
      });
      return;
    }
    seenInFile.add(key);
    if (taken.has(key)) {
      errors.push({
        field: 'name',
        message: 'This candidate already contests this portfolio',
        row: rowNumber,
      });
      return;
    }

    rows.push({
      electionId,
      email: parsed.data.email,
      manifesto: parsed.data.manifesto,
      name: parsed.data.name,
      nickname: parsed.data.nickname,
      partySymbol: parsed.data.partySymbol,
      phone: parsed.data.phone,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
    });
  });

  errors.sort((a, b) => a.row - b.row);
  return {
    errors,
    ignoredColumns,
    rows,
    summary: {
      invalid: records.length - rows.length,
      total: records.length,
      valid: rows.length,
    },
  };
};
