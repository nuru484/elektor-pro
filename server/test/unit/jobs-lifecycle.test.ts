import type { Queue, Worker } from 'bullmq';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/error-reporting.js', () => ({
  reportError: vi.fn(),
}));

import {
  _resetJobRegistryForTests,
  attachWorkerFailureReporting,
  registerQueue,
  registerWorker,
  stopWorkers,
} from '../../src/jobs/lifecycle.js';
import { reportError } from '../../src/lib/error-reporting.js';

type FailedHandler = (
  job: undefined | { data?: { requestId?: string }; id?: string },
  err: Error,
) => void;

const fakeWorker = () => {
  const handlers: Record<string, FailedHandler[]> = {};
  return {
    close: vi.fn().mockResolvedValue(undefined),
    handlers,
    name: 'testQueue',
    on: vi.fn((event: string, handler: FailedHandler) => {
      handlers[event] = [...(handlers[event] ?? []), handler];
    }),
  };
};

const fakeQueue = () => ({
  close: vi.fn().mockResolvedValue(undefined),
  name: 'testQueue',
});

describe('jobs lifecycle registry', () => {
  afterEach(() => {
    _resetJobRegistryForTests();
  });

  it('registerQueue / registerWorker return the same instance (chainable)', () => {
    const queue = fakeQueue();
    const worker = fakeWorker();
    expect(registerQueue(queue as unknown as Queue)).toBe(queue);
    expect(registerWorker(worker as unknown as Worker)).toBe(worker);
  });

  it('stopWorkers closes every registered worker and queue', async () => {
    const workerA = fakeWorker();
    const workerB = fakeWorker();
    const queue = fakeQueue();
    registerWorker(workerA as unknown as Worker);
    registerWorker(workerB as unknown as Worker);
    registerQueue(queue as unknown as Queue);

    await stopWorkers();

    expect(workerA.close).toHaveBeenCalledOnce();
    expect(workerB.close).toHaveBeenCalledOnce();
    expect(queue.close).toHaveBeenCalledOnce();
  });

  it('stopWorkers is a no-op with an empty registry', async () => {
    await expect(stopWorkers()).resolves.toBeUndefined();
  });

  it('attachWorkerFailureReporting subscribes to failed events', () => {
    const worker = fakeWorker();
    registerWorker(worker as unknown as Worker);

    attachWorkerFailureReporting();

    expect(worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    // Firing the handler must not throw even with reporting disabled (no DSN).
    const [handler] = worker.handlers.failed;
    expect(() => {
      handler({ id: 'job-1' }, new Error('job blew up'));
    }).not.toThrow();
  });

  it('failure reports carry the job\'s originating requestId', () => {
    const worker = fakeWorker();
    registerWorker(worker as unknown as Worker);
    attachWorkerFailureReporting();

    const [handler] = worker.handlers.failed;
    const err = new Error('job blew up');
    handler({ data: { requestId: 'req-1' }, id: 'job-2' }, err);

    expect(reportError).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ errorId: 'job_testQueue_job-2', requestId: 'req-1' }),
    );
  });
});
