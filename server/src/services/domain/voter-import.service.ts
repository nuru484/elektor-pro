// src/services/domain/voter-import.service.ts
//
// Voter file import, preview-first: parse a CSV/XLSX upload, normalize the
// headers admins actually use ("Full Name", "Index Number", ...), validate
// every row, and report per-row problems (including duplicates within the
// file and against the database) WITHOUT writing anything. The client shows
// the preview and then submits the valid rows through the existing
// POST /voters/bulk, so the write path stays single, transactional, and
// maker-checker governed.
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { z } from 'zod';

import prisma from '../../lib/prisma.js';
import { BadRequestError } from '../../middlewares/error-handler.js';
import { validateAndFormatPhone } from '../../utils/validate-phone.js';

/**
 * Upper bound on a single file, kept only as a guard against a runaway upload
 * (a corrupt or hostile file), not as a capability limit. Imports commit in
 * chunks rather than in one transaction, so this sits far above any real
 * register.
 */
export const MAX_IMPORT_ROWS = 100_000;

export interface ImportPreview {
  errors: ImportRowError[];
  ignoredColumns: string[];
  rows: ImportVoterRow[];
  summary: { invalid: number; total: number; valid: number };
}

export interface ImportRowError {
  field: string;
  message: string;
  /** 1-based data row number (header excluded), matching what admins see. */
  row: number;
}

/** Canonical row shape, matching what POST /voters/bulk accepts. */
export interface ImportVoterRow {
  email?: string;
  name: string;
  phoneNumber?: string;
  voterId: string;
}

// Header aliases -> canonical field. Keys are compared after lowercasing and
// stripping spaces/underscores/dashes, so "Voter ID", "voter_id" and
// "VOTER-ID" all match.
const HEADER_ALIASES: Record<string, keyof ImportVoterRow> = {
  email: 'email',
  emailaddress: 'email',
  fullname: 'name',
  index: 'voterId',
  indexnumber: 'voterId',
  mobile: 'phoneNumber',
  msisdn: 'phoneNumber',
  name: 'name',
  phone: 'phoneNumber',
  phonenumber: 'phoneNumber',
  registrationnumber: 'voterId',
  studentid: 'voterId',
  voterid: 'voterId',
};

const canonicalHeader = (raw: string): keyof ImportVoterRow | null =>
  HEADER_ALIASES[raw.toLowerCase().replaceAll(/[\s_-]/g, '')] ?? null;

const rowSchema = z.object({
  email: z.email('Invalid email address').optional(),
  name: z.string().min(1, 'Name is required').max(150),
  phoneNumber: z.string().min(6, 'Phone number looks too short').max(20).optional(),
  voterId: z.string().min(1, 'Voter ID is required').max(60),
});

const isCsv = (filename: string, mimetype: string): boolean =>
  filename.toLowerCase().endsWith('.csv') ||
  mimetype === 'text/csv' ||
  mimetype === 'application/csv';

const isXlsx = (filename: string, mimetype: string): boolean =>
  filename.toLowerCase().endsWith('.xlsx') ||
  mimetype ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Raw parse to header->value records; throws on unsupported formats. Shared
 * with the candidate import.
 */
export const parseRecords = async (
  file: { buffer: Buffer; mimetype: string; originalname: string },
): Promise<Record<string, string>[]> => {
  if (isCsv(file.originalname, file.mimetype)) {
    return parse(file.buffer, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as unknown as Record<string, string>[];
  }
  if (isXlsx(file.originalname, file.mimetype)) {
    const workbook = new ExcelJS.Workbook();
    // exceljs types its load() input as an ES2024 ArrayBuffer shape that a
    // Node Buffer does not satisfy nominally; it accepts Buffers at runtime.
    await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets.at(0);
    if (!sheet) return [];
    const headers: (string | undefined)[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
      headers[col] = cell.text.trim();
    });
    const records: Record<string, string>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string> = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const header = headers[col];
        if (!header) return;
        const value = cell.text.trim();
        if (value) record[header] = value;
      });
      if (Object.keys(record).length > 0) records.push(record);
    });
    return records;
  }
  throw new BadRequestError('Unsupported file type: upload a .csv or .xlsx file', {
    code: 'UNSUPPORTED_IMPORT_FILE',
    layer: 'voter-import',
  });
};

/**
 * Parse + validate an uploaded voter file. Pure preview: no writes. Rows that
 * fail validation or collide (within the file or with existing voters) are
 * reported in `errors` and excluded from `rows`.
 */
export const previewVoterImport = async (file: {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}): Promise<ImportPreview> => {
  const records = await parseRecords(file);
  if (records.length === 0) {
    throw new BadRequestError('The file has no data rows', {
      code: 'EMPTY_IMPORT_FILE',
      layer: 'voter-import',
    });
  }
  if (records.length > MAX_IMPORT_ROWS) {
    throw new BadRequestError(
      `The file has ${String(records.length)} rows; the limit per import is ${String(MAX_IMPORT_ROWS)}`,
      { code: 'IMPORT_TOO_LARGE', layer: 'voter-import' },
    );
  }

  // Header mapping (from the first record's keys).
  const ignoredColumns: string[] = [];
  const mapping = new Map<string, keyof ImportVoterRow>();
  for (const rawHeader of Object.keys(records[0])) {
    const canonical = canonicalHeader(rawHeader);
    if (canonical) mapping.set(rawHeader, canonical);
    else ignoredColumns.push(rawHeader);
  }
  if (![...mapping.values()].includes('name') || ![...mapping.values()].includes('voterId')) {
    throw new BadRequestError(
      'Could not find the required columns: the file needs a name column and a voter ID column',
      { code: 'MISSING_IMPORT_COLUMNS', layer: 'voter-import' },
    );
  }

  const errors: ImportRowError[] = [];
  const rows: ImportVoterRow[] = [];
  const seen = {
    email: new Map<string, number>(),
    phoneNumber: new Map<string, number>(),
    voterId: new Map<string, number>(),
  };

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

    // Canonicalize contact before any comparison: emails lowercase, phones
    // E.164 - otherwise the same number written differently slips past both
    // the in-file dedup and the existing-voter checks, only to explode on
    // the unique constraint at insert time.
    if (parsed.data.email) parsed.data.email = parsed.data.email.toLowerCase();
    if (parsed.data.phoneNumber) {
      try {
        parsed.data.phoneNumber = validateAndFormatPhone(
          parsed.data.phoneNumber,
          'GH',
        ).e164Format;
      } catch {
        errors.push({
          field: 'phoneNumber',
          message: 'Not a valid phone number',
          row: rowNumber,
        });
        return;
      }
    }

    // In-file duplicate detection on the identifying columns.
    let duplicate = false;
    for (const field of ['voterId', 'phoneNumber', 'email'] as const) {
      const value = parsed.data[field]?.toLowerCase();
      if (!value) continue;
      const firstRow = seen[field].get(value);
      if (firstRow) {
        errors.push({
          field,
          message: `Duplicate of row ${String(firstRow)} in this file`,
          row: rowNumber,
        });
        duplicate = true;
      } else {
        seen[field].set(value, rowNumber);
      }
    }
    if (!duplicate) rows.push(parsed.data);
  });

  // Collisions with voters already registered (voterId / phone / email are
  // unique). `deletedAt: {}` (an empty filter) overrides the soft-delete
  // extension's default scoping, so clashes with soft-deleted voters - whose
  // unique constraints still exist - surface here instead of at insert time.
  const phones = rows.map((r) => r.phoneNumber).filter((v): v is string => Boolean(v));
  const emails = rows.map((r) => r.email).filter((v): v is string => Boolean(v));
  const [existingVoterIds, existingPhones, existingEmails] = await Promise.all([
    prisma.voter.findMany({
      select: { voterId: true },
      where: { deletedAt: {}, voterId: { in: rows.map((r) => r.voterId) } },
    }),
    phones.length
      ? prisma.voter.findMany({
          select: { phoneNumber: true },
          where: { deletedAt: {}, phoneNumber: { in: phones } },
        })
      : [],
    emails.length
      ? prisma.voter.findMany({
          select: { email: true },
          where: { deletedAt: {}, email: { in: emails } },
        })
      : [],
  ]);
  const takenVoterIds = new Set(existingVoterIds.map((v) => v.voterId));
  const takenPhones = new Set(existingPhones.map((v) => v.phoneNumber));
  const takenEmails = new Set(existingEmails.map((v) => v.email));

  const stillValid: ImportVoterRow[] = [];
  for (const row of rows) {
    const rowNumber = seen.voterId.get(row.voterId.toLowerCase()) ?? 0;
    if (takenVoterIds.has(row.voterId)) {
      errors.push({
        field: 'voterId',
        message: 'A voter with this voter ID already exists',
        row: rowNumber,
      });
    } else if (row.phoneNumber && takenPhones.has(row.phoneNumber)) {
      errors.push({
        field: 'phoneNumber',
        message: 'A voter with this phone number already exists',
        row: rowNumber,
      });
    } else if (row.email && takenEmails.has(row.email)) {
      errors.push({
        field: 'email',
        message: 'A voter with this email already exists',
        row: rowNumber,
      });
    } else {
      stillValid.push(row);
    }
  }
  errors.sort((a, b) => a.row - b.row);

  return {
    errors,
    ignoredColumns,
    rows: stillValid,
    summary: {
      invalid: records.length - stillValid.length,
      total: records.length,
      valid: stillValid.length,
    },
  };
};
