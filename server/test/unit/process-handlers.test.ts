import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/error-reporting.js', () => ({
  flushErrorReporting: vi.fn().mockResolvedValue(undefined),
  reportError: vi.fn(),
}));

import { flushErrorReporting, reportError } from '../../src/lib/error-reporting.js';
import { registerProcessHandlers } from '../../src/lib/process-handlers.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('process handlers', () => {
  const shutdown = vi.fn().mockResolvedValue(undefined);
  let emitter: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    emitter = new EventEmitter();
    registerProcessHandlers({ shutdown }, emitter);
  });

  it('reports and flushes an unhandled rejection, then shuts down with exit code 1', async () => {
    const reason = new Error('boom');
    emitter.emit('unhandledRejection', reason);
    await tick();
    expect(reportError).toHaveBeenCalledWith(
      reason,
      expect.objectContaining({ errorId: 'unhandled-rejection', severity: 'critical' }),
    );
    expect(flushErrorReporting).toHaveBeenCalledOnce();
    expect(shutdown).toHaveBeenCalledWith('unhandledRejection', 1);
    expect(vi.mocked(flushErrorReporting).mock.invocationCallOrder[0]).toBeLessThan(
      shutdown.mock.invocationCallOrder[0],
    );
  });

  it('reports an uncaught exception then shuts down with exit code 1', async () => {
    const error = new Error('crash');
    emitter.emit('uncaughtException', error);
    await tick();
    expect(reportError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ errorId: 'uncaught-exception', severity: 'critical' }),
    );
    expect(shutdown).toHaveBeenCalledWith('uncaughtException', 1);
  });

  it('ignores the dev watch-mode IPC close race', async () => {
    const error = Object.assign(new Error('ipc'), { code: 'ERR_IPC_CHANNEL_CLOSED' });
    emitter.emit('uncaughtException', error);
    await tick();
    expect(reportError).not.toHaveBeenCalled();
    expect(shutdown).not.toHaveBeenCalled();
  });
});
