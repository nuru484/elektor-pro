import type { TxClient } from '../../types/prisma.types.js';

// src/services/domain/import-batch.service.ts
//
// Large imports, written in chunks instead of one transaction.
//
// The direct bulk path writes every row inside a single transaction. That is
// the right shape for a few hundred rows and the wrong one for fifty
// thousand: the transaction is held open for minutes, blocks vacuum, and
// eventually times out - so the import was capped at 5,000 rows rather than
// fixed.
//
// Here the validated rows are persisted first, then written a chunk at a
// time. Each chunk advances `processedRows` IN THE SAME TRANSACTION that
// writes it, which is what makes the whole thing resumable: a worker that
// dies mid-import restarts from the cursor, re-writing nothing it already
// committed and skipping nothing it had not reached.
import {
  ImportKind,
  ImportStatus,
  type Prisma,
} from '../../../generated/prisma/client.js';
import prisma from '../../lib/prisma.js';
import { NotFoundError } from '../../middlewares/error-handler.js';
import logger from '../../utils/logger.js';
import { appendAudit } from '../audit/audit.service.js';
import { createCandidateInTx } from './candidate.service.js';
import { createVoterInTx, type VoterInput } from './voter.service.js';

/**
 * Rows per transaction. Small enough that a chunk commits quickly and a crash
 * loses little work; large enough that a 50,000-row import is ~100 round
 * trips rather than 50,000.
 */
export const IMPORT_CHUNK_SIZE = 500;

export interface CreateImportBatchInput {
  actorId?: string;
  electionId?: string;
  kind: ImportKind;
  rows: unknown[];
}

/** A row that could not be written, kept so an admin can fix just those. */
interface RowError {
  message: string;
  row: number;
}

/** Persist the validated rows and hand back a batch to process. */
export const createImportBatch = async (input: CreateImportBatchInput) => {
  const batch = await prisma.importBatch.create({
    data: {
      createdById: input.actorId ?? null,
      electionId: input.electionId ?? null,
      kind: input.kind,
      rows: input.rows as Prisma.InputJsonValue,
      totalRows: input.rows.length,
    },
    select: { id: true, kind: true, status: true, totalRows: true },
  });
  return batch;
};

/** Write one row, by kind. Throwing marks the row failed, not the batch. */
const writeRow = async (
  tx: TxClient,
  kind: ImportKind,
  row: unknown,
): Promise<void> => {
  if (kind === ImportKind.VOTER) {
    await createVoterInTx(tx, row as VoterInput);
    return;
  }
  await createCandidateInTx(tx, row as Parameters<typeof createCandidateInTx>[1]);
};

/**
 * Process a batch to completion, resuming from wherever it stopped.
 *
 * Safe to call again on the same batch: an already-completed batch returns
 * immediately, and a partially-processed one continues from its cursor. That
 * is what lets the queue retry this job without duplicating rows.
 */
export const processImportBatch = async (batchId: string) => {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
  });
  if (!batch) throw new NotFoundError('Import batch not found');
  if (
    batch.status === ImportStatus.COMPLETED ||
    batch.status === ImportStatus.PARTIAL
  ) {
    return batch;
  }

  const rows = batch.rows as unknown[];
  await prisma.importBatch.update({
    data: {
      startedAt: batch.startedAt ?? new Date(),
      status: ImportStatus.PROCESSING,
    },
    where: { id: batchId },
  });

  let cursor = batch.processedRows;
  const errors: RowError[] = (batch.errors as null | RowError[]) ?? [];

  while (cursor < rows.length) {
    const chunk = rows.slice(cursor, cursor + IMPORT_CHUNK_SIZE);
    const chunkStart = cursor;

    // Fast path: the whole chunk plus the cursor in ONE transaction. This is
    // what the common case (every row good) costs - one round trip per 500
    // rows - and the cursor moving inside it is what makes a crash resume
    // exactly, re-writing nothing already committed.
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of chunk) await writeRow(tx, batch.kind, row);
        await tx.importBatch.update({
          data: {
            createdRows: { increment: chunk.length },
            processedRows: chunkStart + chunk.length,
          },
          where: { id: batchId },
        });
      });
      cursor = chunkStart + chunk.length;
      continue;
    } catch {
      // One bad row aborts the whole transaction - Postgres refuses every
      // later statement in it, so the failure cannot be caught and stepped
      // over from inside. Nothing was written, so the chunk is replayed row
      // by row to find out which ones are actually bad.
    }

    for (const [offset, row] of chunk.entries()) {
      const rowNumber = chunkStart + offset + 1;
      try {
        // Row and cursor together, so this stays exactly-once even if the
        // process dies partway through the slow path.
        await prisma.$transaction(async (tx) => {
          await writeRow(tx, batch.kind, row);
          await tx.importBatch.update({
            data: {
              createdRows: { increment: 1 },
              processedRows: chunkStart + offset + 1,
            },
            where: { id: batchId },
          });
        });
      } catch (error) {
        errors.push({
          message: error instanceof Error ? error.message : 'Unknown error',
          row: rowNumber,
        });
        await prisma.importBatch.update({
          data: {
            failedRows: { increment: 1 },
            processedRows: chunkStart + offset + 1,
          },
          where: { id: batchId },
        });
      }
    }
    cursor = chunkStart + chunk.length;
  }

  const finished = await prisma.importBatch.update({
    data: {
      completedAt: new Date(),
      errors: errors.length > 0 ? (errors as unknown as Prisma.InputJsonValue) : undefined,
      status: errors.length > 0 ? ImportStatus.PARTIAL : ImportStatus.COMPLETED,
    },
    where: { id: batchId },
  });

  await appendAudit(prisma, {
    action: 'import.completed',
    actorId: batch.createdById ?? undefined,
    entity: 'ImportBatch',
    entityId: batchId,
    metadata: {
      created: finished.createdRows,
      failed: finished.failedRows,
      kind: batch.kind,
      total: finished.totalRows,
    },
  });
  logger.info(
    { batchId, created: finished.createdRows, failed: finished.failedRows },
    'Import batch finished',
  );
  return finished;
};

/** Record a batch as failed outright (the job exhausted its retries). */
export const failImportBatch = async (
  batchId: string,
  message: string,
): Promise<void> => {
  await prisma.importBatch.update({
    data: { completedAt: new Date(), error: message, status: ImportStatus.FAILED },
    where: { id: batchId },
  });
};

/** Status for the admin's progress view. Rows are omitted - they can be huge. */
export const getImportBatch = async (id: string) => {
  const batch = await prisma.importBatch.findUnique({
    select: {
      completedAt: true,
      createdAt: true,
      createdRows: true,
      error: true,
      errors: true,
      failedRows: true,
      id: true,
      kind: true,
      processedRows: true,
      startedAt: true,
      status: true,
      totalRows: true,
    },
    where: { id },
  });
  if (!batch) throw new NotFoundError('Import batch not found');
  return batch;
};
