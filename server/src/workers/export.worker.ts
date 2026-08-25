// src/workers/export.worker.ts
//
// Renders queued exports. Import-for-side-effect from server.ts. With
// REDIS_URL unset there is no queue, and the controller streams exports
// synchronously instead - so the feature works without Redis rather than
// breaking in its absence.
import type { ConnectionOptions } from 'bullmq';

import { Worker } from 'bullmq';

import { createRedisConnection, queuesEnabled } from '../jobs/connection.js';
import { type ExportJobData, exportQueue } from '../jobs/exports.queue.js';
import { registerWorker } from '../jobs/lifecycle.js';
import { QUEUE_NAMES } from '../jobs/queue-names.js';
import { getRequestId, runWithRequestId } from '../lib/request-store.js';
import {
  failExportJob,
  processExportJob,
} from '../services/results/export-job.service.js';
import logger from '../utils/logger.js';

/** Queue an export, or render it here and now when there is no queue. */
export const runExportJob = async (exportJobId: string): Promise<boolean> => {
  const queue = exportQueue();
  if (queue) {
    await queue.add('export', { exportJobId, requestId: getRequestId() }, { jobId: exportJobId });
    return true;
  }
  await processExportJob(exportJobId);
  return false;
};

if (queuesEnabled()) {
  const connection = createRedisConnection();
  if (connection) {
    const worker = registerWorker(
      new Worker<ExportJobData>(
        QUEUE_NAMES.EXPORTS,
        (job) =>
          runWithRequestId(job.data.requestId, async () => {
            await processExportJob(job.data.exportJobId);
          }),
        {
          // Rendering a large PDF is CPU-bound and this shares a process with
          // the API; two at once would compete for the event loop that is
          // also serving ballots.
          concurrency: 1,
          connection: connection as unknown as ConnectionOptions,
        },
      ),
    );

    // Only when the last attempt is spent - an earlier failure will retry.
    worker.on('failed', (job, error) => {
      if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
      void failExportJob(job.data.exportJobId, error.message);
    });

    logger.info('Export worker started');
  }
} else {
  logger.info('Export worker disabled (REDIS_URL not set); exports stream synchronously');
}
