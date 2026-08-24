// src/lib/process-handlers.ts
import logger from '../utils/logger.js';
import { flushErrorReporting, reportError } from './error-reporting.js';

interface ProcessHandlerDeps {
  shutdown: (signal: string, exitCode: number) => Promise<void>;
}

/** A crash-sourced shutdown exits non-zero even after a clean drain. */
const CRASH_EXIT_CODE = 1;

/**
 * Last-resort handlers for errors nothing else caught. Both report to the
 * tracker and then drive the coordinated shutdown: the process state is
 * undefined after either, so it must not keep serving traffic. The platform
 * restarts it.
 */
export const registerProcessHandlers = (
  { shutdown }: ProcessHandlerDeps,
  emitter: Pick<NodeJS.EventEmitter, 'on'> = process,
): void => {
  // A rejected promise nobody awaited leaves whatever it was doing half
  // finished, so the process state is as undefined as after a thrown
  // exception. Report it (flushed before the drain, so the event survives
  // even a stuck shutdown) and shut down; the platform restarts the process.
  emitter.on('unhandledRejection', (reason: unknown) => {
    logger.fatal(reason, 'Unhandled promise rejection');
    reportError(reason, {
      errorId: 'unhandled-rejection',
      layer: 'process',
      severity: 'critical',
    });
    void flushErrorReporting().then(() => shutdown('unhandledRejection', CRASH_EXIT_CODE));
  });

  // An uncaught exception leaves the process in an undefined state - log it and
  // shut down cleanly rather than continuing to serve traffic.
  emitter.on('uncaughtException', (error: Error) => {
    // Dev-only noise: under `tsx --watch`, Node reports lazily-required modules
    // to the watch parent over IPC. If that channel has already closed (a reload
    // race), `process.send` throws ERR_IPC_CHANNEL_CLOSED mid-request. The app
    // state is fine, so keep serving rather than killing the dev server. This
    // cannot occur under a plain `node` production start (no watch IPC).
    if ((error as NodeJS.ErrnoException).code === 'ERR_IPC_CHANNEL_CLOSED') {
      logger.warn('Ignoring watch-mode ERR_IPC_CHANNEL_CLOSED (dev-only)');
      return;
    }

    logger.fatal(error, 'Uncaught exception');
    reportError(error, {
      errorId: 'uncaught-exception',
      layer: 'process',
      severity: 'critical',
    });
    void shutdown('uncaughtException', CRASH_EXIT_CODE);
  });
};
