import {
  createImportBatch,
  getImportBatch,
  processImportBatch,
} from '#services/domain/import-batch.service.js';
// test/integration/import-batch.test.ts
//
// Chunked imports. The properties worth testing are the ones the design
// rests on: a bad row must not take its chunk down, progress must be durable
// so a restart resumes instead of duplicating, and re-processing a finished
// batch must be a no-op.
import { beforeEach, describe, expect, it } from 'vitest';

import { ImportKind, ImportStatus } from '../../generated/prisma/client.js';
import { prisma, resetDb } from '../helpers.js';

const voterRows = (count: number, prefix = 'IMP') =>
  Array.from({ length: count }, (_, i) => ({
    name: `Imported ${prefix}${String(i)}`,
    phoneNumber: `+2335510${String(10000 + i)}`,
    voterId: `${prefix}${String(i)}`,
  }));

describe('chunked imports', () => {
  beforeEach(resetDb);

  it('writes every row and reports completion', async () => {
    const batch = await createImportBatch({
      kind: ImportKind.VOTER,
      rows: voterRows(25),
    });
    const done = await processImportBatch(batch.id);

    expect(done.status).toBe(ImportStatus.COMPLETED);
    expect(done.createdRows).toBe(25);
    expect(done.failedRows).toBe(0);
    expect(done.processedRows).toBe(25);
    expect(await prisma.voter.count({ where: { voterId: { startsWith: 'IMP' } } })).toBe(25);
  });

  it('records a bad row without abandoning the rest of its chunk', async () => {
    // A duplicate voterId is the realistic bad row: it violates a unique
    // constraint at write time, having passed validation at preview time.
    const rows = voterRows(5, 'DUP');
    rows.push({ ...rows[0] });

    const batch = await createImportBatch({ kind: ImportKind.VOTER, rows });
    const done = await processImportBatch(batch.id);

    expect(done.status).toBe(ImportStatus.PARTIAL);
    expect(done.createdRows).toBe(5);
    expect(done.failedRows).toBe(1);
    const errors = done.errors as { row: number }[];
    expect(errors).toHaveLength(1);
    // Reported 1-based, so it matches the row number the admin sees.
    expect(errors[0].row).toBe(6);
  });

  it('resumes from the cursor instead of rewriting what it already committed', async () => {
    const batch = await createImportBatch({
      kind: ImportKind.VOTER,
      rows: voterRows(10, 'RES'),
    });

    // Simulate a worker that died after committing the first four rows: the
    // rows exist and the cursor has advanced, exactly as the chunk
    // transaction would have left it.
    for (const row of voterRows(10, 'RES').slice(0, 4)) {
      await prisma.voter.create({
        data: { name: row.name, phoneNumber: row.phoneNumber, voterId: row.voterId },
      });
    }
    await prisma.importBatch.update({
      data: { createdRows: 4, processedRows: 4, status: ImportStatus.PROCESSING },
      where: { id: batch.id },
    });

    const done = await processImportBatch(batch.id);

    expect(done.status).toBe(ImportStatus.COMPLETED);
    // 4 already there + 6 written now, and crucially no duplicate failures:
    // the first four were never retried.
    expect(done.createdRows).toBe(10);
    expect(done.failedRows).toBe(0);
    expect(await prisma.voter.count({ where: { voterId: { startsWith: 'RES' } } })).toBe(10);
  });

  it('is a no-op when the batch has already finished', async () => {
    const batch = await createImportBatch({
      kind: ImportKind.VOTER,
      rows: voterRows(3, 'ONCE'),
    });
    await processImportBatch(batch.id);
    // A queue retry after completion must not write the rows a second time.
    await processImportBatch(batch.id);

    expect(await prisma.voter.count({ where: { voterId: { startsWith: 'ONCE' } } })).toBe(3);
  });

  it('exposes progress without shipping the rows back', async () => {
    const batch = await createImportBatch({
      kind: ImportKind.VOTER,
      rows: voterRows(3, 'PROG'),
    });
    const status = await getImportBatch(batch.id);

    expect(status.totalRows).toBe(3);
    expect(status.status).toBe(ImportStatus.PENDING);
    // The payload can be tens of thousands of rows; a progress poll must not
    // carry it.
    expect(status).not.toHaveProperty('rows');
  });
});
