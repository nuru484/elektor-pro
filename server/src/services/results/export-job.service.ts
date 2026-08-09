// src/services/results/export-job.service.ts
//
// Results exports generated in the background and collected afterwards.
//
// A small election still streams straight back in the response, which is the
// right shape for a file that renders in milliseconds. A large one does not:
// rendering the PDF holds the request open long enough to risk a proxy
// timeout, and blocks a connection while it works. So the render moves to a
// worker, the file lands on disk, and the admin is handed a token to collect
// it with.
//
// The token, not the row id, is the credential in the download URL. Ids show
// up in logs and admin screens; a results file must not be readable by
// anyone who happens to read a log line.
import { randomBytes } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ExportFormat,
  ExportStatus,
} from '../../../generated/prisma/client.js';
import ENV from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { NotFoundError } from '../../middlewares/error-handler.js';
import logger from '../../utils/logger.js';
import { exportResultsCsv, exportResultsPdf } from './export.service.js';

/** How long a generated file stays collectable before the sweep removes it. */
const RETENTION_HOURS = 24;

/** Where generated files land. Configurable so a host with a mounted disk can point at it. */
const exportDir = (): string => path.resolve(ENV.EXPORT_DIR);

const safeSlug = (value: string): string =>
  value.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60);

/** Create the row and hand back the token the client will collect with. */
export const createExportJob = async (input: {
  electionId: string;
  format: ExportFormat;
  requestedById?: string;
}) => {
  const expiresAt = new Date(Date.now() + RETENTION_HOURS * 60 * 60 * 1000);
  return prisma.exportJob.create({
    data: {
      downloadToken: randomBytes(32).toString('hex'),
      electionId: input.electionId,
      expiresAt,
      format: input.format,
      requestedById: input.requestedById ?? null,
    },
    select: {
      downloadToken: true,
      expiresAt: true,
      format: true,
      id: true,
      status: true,
    },
  });
};

/**
 * Render the file and mark the job ready.
 *
 * Idempotent: a job already READY returns as-is, so a queue retry after a
 * successful render does not regenerate the file or orphan the previous one.
 */
export const processExportJob = async (jobId: string) => {
  const job = await prisma.exportJob.findUnique({
    include: { election: { select: { name: true, slug: true } } },
    where: { id: jobId },
  });
  if (!job) throw new NotFoundError('Export job not found');
  if (job.status === ExportStatus.READY) return job;

  await prisma.exportJob.update({
    data: { status: ExportStatus.PROCESSING },
    where: { id: jobId },
  });

  const directory = exportDir();
  await mkdir(directory, { recursive: true });

  const extension = job.format === ExportFormat.PDF ? 'pdf' : 'csv';
  const fileName = `${safeSlug(job.election.slug)}-results.${extension}`;
  // The token names the file too, so two exports of the same election cannot
  // collide and a guessed filename does not reach someone else's export.
  const filePath = path.join(directory, `${job.downloadToken}.${extension}`);

  const contents =
    job.format === ExportFormat.PDF
      ? await exportResultsPdf(job.electionId)
      : Buffer.from(await exportResultsCsv(job.electionId), 'utf8');
  await writeFile(filePath, contents);
  const { size } = await stat(filePath);

  const ready = await prisma.exportJob.update({
    data: {
      byteSize: size,
      completedAt: new Date(),
      fileName,
      filePath,
      status: ExportStatus.READY,
    },
    where: { id: jobId },
  });
  logger.info({ bytes: size, jobId }, 'Export ready');
  return ready;
};

export const failExportJob = async (
  jobId: string,
  message: string,
): Promise<void> => {
  await prisma.exportJob.update({
    data: { completedAt: new Date(), error: message, status: ExportStatus.FAILED },
    where: { id: jobId },
  });
};

/** Status for polling. The token is included so the client can build the link. */
export const getExportJob = async (id: string) => {
  const job = await prisma.exportJob.findUnique({
    select: {
      byteSize: true,
      completedAt: true,
      downloadToken: true,
      error: true,
      expiresAt: true,
      fileName: true,
      format: true,
      id: true,
      status: true,
    },
    where: { id },
  });
  if (!job) throw new NotFoundError('Export job not found');
  return job;
};

/**
 * Resolve a download token to a file, refusing anything expired or not ready.
 *
 * Expiry is enforced here rather than left to the sweep: the sweep runs on a
 * schedule, so between runs an expired token would still work if this did not
 * check.
 */
export const resolveExportDownload = async (token: string) => {
  const job = await prisma.exportJob.findUnique({
    select: {
      expiresAt: true,
      fileName: true,
      filePath: true,
      format: true,
      status: true,
    },
    where: { downloadToken: token },
  });
  if (job?.status !== ExportStatus.READY || !job.filePath) {
    throw new NotFoundError('Export not found');
  }
  if (job.expiresAt.getTime() < Date.now()) {
    throw new NotFoundError('This export has expired; generate a new one');
  }
  return { fileName: job.fileName ?? 'results', filePath: job.filePath, format: job.format };
};

/**
 * Delete expired exports from disk and mark the rows gone.
 *
 * Results should not accumulate on a box indefinitely - they are the most
 * sensitive artefact this system produces. A missing file is not an error
 * here: the instance that wrote it may have been replaced, which is exactly
 * why the download path treats a missing file as "not found" too.
 */
export const sweepExpiredExports = async (
  now = new Date(),
): Promise<{ removed: number }> => {
  const expired = await prisma.exportJob.findMany({
    select: { filePath: true, id: true },
    where: { expiresAt: { lt: now }, status: ExportStatus.READY },
  });
  for (const job of expired) {
    if (job.filePath) await rm(job.filePath, { force: true });
  }
  if (expired.length > 0) {
    await prisma.exportJob.deleteMany({
      where: { id: { in: expired.map((job) => job.id) } },
    });
  }
  return { removed: expired.length };
};
