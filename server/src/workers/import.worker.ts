// src/workers/import.worker.ts
//
// Runs queued imports. Import-for-side-effect from server.ts; when REDIS_URL
// is unset the queue does not exist and imports run inline instead (see
// runImportBatch below), so the feature works without Redis - it just holds
// the request open while it writes.
import type { ConnectionOptions } from 'bullmq';

import { Worker } from 'bullmq';

import { createRedisConnection, queuesEnabled } from '../jobs/connection.js';
import { type ImportJob, importQueue } from '../jobs/imports.queue.js';
import { registerWorker } from '../jobs/lifecycle.js';
import { QUEUE_NAMES } from '../jobs/queue-names.js';
import {
  failImportBatch,
  processImportBatch,
} from '../services/domain/import-batch.service.js';
import logger from '../utils/logger.js';

/**
 * Send a batch for processing: queued when Redis is configured, run inline
 * when it is not.
 *
 * Returns whether it was queued so the caller can tell the admin whether to
 * poll for progress or treat the import as already done.
 */
export const runImportBatch = async (batchId: string): Promise<boolean> => {
  const queue = importQueue();
  if (queue) {
    // The batch id doubles as the job id: re-submitting the same batch can
    // never start a second worker on it.
    await queue.add('import', { batchId }, { jobId: batchId });
    return true;
  }
  await processImportBatch(batchId);
  return false;
};

if (queuesEnabled()) {
  const connection = createRedisConnection();
  if (connection) {
    const worker = registerWorker(
      new Worker<ImportJob>(
        QUEUE_NAMES.IMPORTS,
        async (job) => {
          await processImportBatch(job.data.batchId);
        },
        {
          // One import at a time: they are write-heavy, and two large ones in
          // parallel would compete for the same connection pool the API needs
          // to keep answering.
          concurrency: 1,
          connection: connection as unknown as ConnectionOptions,
        },
      ),
    );

    // Only once the last attempt is spent - an earlier failure will retry and
    // resume, so marking the batch failed then would be a lie the admin acts
    // on.
    worker.on('failed', (job, error) => {
      if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
      void failImportBatch(job.data.batchId, error.message);
    });

    logger.info('Import worker started');
  }
} else {
  logger.info('Import worker disabled (REDIS_URL not set); imports run inline');
}
