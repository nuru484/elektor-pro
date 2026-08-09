import {
  createExportJob,
  getExportJob,
  processExportJob,
  resolveExportDownload,
  sweepExpiredExports,
} from '#services/results/export-job.service.js';
// test/integration/export-job.test.ts
//
// Background results exports. The properties worth testing are the ones that
// keep a results file from reaching the wrong person: a token that is not
// guessable from the id, expiry enforced at download rather than only by the
// sweep, and files actually removed from disk when they lapse.
import { access } from 'node:fs/promises';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExportFormat, ExportStatus } from '../../generated/prisma/client.js';
import { createElectionFixture, prisma, resetDb } from '../helpers.js';

const exists = async (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

describe('background results exports', () => {
  beforeEach(resetDb);

  it('renders a file and reports it ready', async () => {
    const { election } = await createElectionFixture();
    const job = await createExportJob({
      electionId: election.id,
      format: ExportFormat.CSV,
    });

    const ready = await processExportJob(job.id);

    expect(ready.status).toBe(ExportStatus.READY);
    expect(ready.filePath).toBeTruthy();
    expect(ready.byteSize).toBeGreaterThan(0);
    expect(await exists(ready.filePath!)).toBe(true);
  });

  it('hands out a token that is not the row id', async () => {
    const { election } = await createElectionFixture();
    const job = await createExportJob({
      electionId: election.id,
      format: ExportFormat.CSV,
    });

    // The id appears in logs and admin screens; if it were the credential,
    // reading a log line would be enough to download someone's results.
    expect(job.downloadToken).not.toBe(job.id);
    expect(job.downloadToken.length).toBeGreaterThanOrEqual(32);
  });

  it('refuses a download until the file is ready', async () => {
    const { election } = await createElectionFixture();
    const job = await createExportJob({
      electionId: election.id,
      format: ExportFormat.CSV,
    });

    await expect(resolveExportDownload(job.downloadToken)).rejects.toThrow(
      /not found/i,
    );
  });

  it('refuses an unknown token', async () => {
    await expect(resolveExportDownload('not-a-real-token')).rejects.toThrow(
      /not found/i,
    );
  });

  it('refuses an expired export even before the sweep runs', async () => {
    const { election } = await createElectionFixture();
    const job = await createExportJob({
      electionId: election.id,
      format: ExportFormat.CSV,
    });
    await processExportJob(job.id);
    // The sweep is periodic, so between runs an expired token would still
    // work if the download path did not check expiry itself.
    await prisma.exportJob.update({
      data: { expiresAt: new Date(Date.now() - 1000) },
      where: { id: job.id },
    });

    await expect(resolveExportDownload(job.downloadToken)).rejects.toThrow(
      /expired/i,
    );
  });

  it('removes lapsed files from disk and forgets the row', async () => {
    const { election } = await createElectionFixture();
    const job = await createExportJob({
      electionId: election.id,
      format: ExportFormat.CSV,
    });
    const ready = await processExportJob(job.id);
    await prisma.exportJob.update({
      data: { expiresAt: new Date(Date.now() - 1000) },
      where: { id: job.id },
    });

    const { removed } = await sweepExpiredExports();

    expect(removed).toBe(1);
    expect(await exists(ready.filePath!)).toBe(false);
    expect(await prisma.exportJob.findUnique({ where: { id: job.id } })).toBeNull();
  });

  it('does not regenerate a job that is already ready', async () => {
    const { election } = await createElectionFixture();
    const job = await createExportJob({
      electionId: election.id,
      format: ExportFormat.CSV,
    });
    const first = await processExportJob(job.id);
    // A queue retry after success must not render a second file or orphan
    // the first.
    const second = await processExportJob(job.id);

    expect(second.filePath).toBe(first.filePath);
    expect(second.completedAt?.getTime()).toBe(first.completedAt?.getTime());
  });

  it('exposes status for polling without the file path', async () => {
    const { election } = await createElectionFixture();
    const job = await createExportJob({
      electionId: election.id,
      format: ExportFormat.PDF,
    });
    const status = await getExportJob(job.id);

    expect(status.status).toBe(ExportStatus.PENDING);
    expect(status.format).toBe(ExportFormat.PDF);
    // A server path is of no use to a browser and is not worth leaking.
    expect(status).not.toHaveProperty('filePath');
  });
});
