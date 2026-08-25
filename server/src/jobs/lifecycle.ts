// src/jobs/lifecycle.ts
//
// Central registry + lifecycle for BullMQ queues and workers. Every queue and
// worker module registers itself here at construction, so the server's
// shutdown path and failure reporting never need editing when a new queue
// lands - registration is the wiring.
import type { Queue, Worker } from 'bullmq';

import { capture } from '../lib/analytics.js';
import { reportError } from '../lib/error-reporting.js';
import { runWithRequestId } from '../lib/request-store.js';
import { requestLogger } from '../utils/logger.js';

const queues: Queue[] = [];
const workers: Worker[] = [];

/** Register a queue (producer side) for coordinated shutdown. */
export const registerQueue = <T extends Queue>(queue: T): T => {
  queues.push(queue);
  return queue;
};

/** Register a worker (consumer side) for coordinated shutdown + reporting. */
export const registerWorker = <T extends Worker>(worker: T): T => {
  workers.push(worker);
  return worker;
};

interface JobSummary {
  attemptsMade?: number;
  data?: { requestId?: string };
  id?: string;
  name?: string;
}

/**
 * Forwards every registered worker's job failures to the error tracker.
 * Background job failures have no HTTP error handler to report them; without
 * this, a silent background failure (a stuck notification blast, a broken
 * export) only surfaces in a log nobody is tailing. Called once from server.ts
 * after initErrorReporting(); a no-op tracker makes it free. Completed and
 * failed jobs are also product events, so queue health is visible next to
 * the user actions that fed the queue.
 */
export const attachWorkerFailureReporting = (): void => {
  for (const worker of workers) {
    worker.on('failed', (job: JobSummary | undefined, err: Error) => {
      const requestId = job?.data?.requestId;
      const details = {
        attemptsMade: job?.attemptsMade,
        jobId: job?.id,
        jobName: job?.name,
        queue: worker.name,
      };
      runWithRequestId(requestId, () => {
        requestLogger(details).error(err, 'Job failed');
        reportError(err, {
          details,
          // Queue + job id is the searchable handle for a background failure;
          // the requestId links it back to the request that enqueued it.
          errorId: `job_${worker.name}_${job?.id ?? 'unknown'}`,
          layer: 'worker',
          requestId,
          severity: 'high',
        });
        capture({ event: 'job.failed', properties: { ...details, error: err.message } });
      });
    });
    worker.on('completed', (job: JobSummary | undefined) => {
      capture({
        event: 'job.completed',
        properties: { jobId: job?.id, jobName: job?.name, queue: worker.name },
      });
    });
  }
};

/**
 * Gracefully stops all registered workers and queues. Workers close first -
 * that stops fetching new jobs and waits for in-flight jobs to finish - then
 * the queue producers close, releasing every Redis connection so the process
 * can exit cleanly with no leaked sockets. Called from the server's
 * coordinated shutdown path.
 */
export const stopWorkers = async (): Promise<void> => {
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(queues.map((queue) => queue.close()));
};

/** Test-only: clear the registry between specs. */
export const _resetJobRegistryForTests = (): void => {
  queues.length = 0;
  workers.length = 0;
};
