// server.ts
import { createServer } from 'node:http';

import app from './app.js';
import ENV from './src/config/env.js';
import {
  attachWorkerFailureReporting,
  stopWorkers,
} from './src/jobs/lifecycle.js';
import {
  flushErrorReporting,
  initErrorReporting,
  reportError,
} from './src/lib/error-reporting.js';
import prisma from './src/lib/prisma.js';
import { closeRateLimitStore } from './src/middlewares/rateLimit.js';
import { closeRealtime, initRealtime } from './src/realtime/io.js';
import logger from './src/utils/logger.js';

// Before the server starts taking traffic or workers pick up jobs, so no
// early error goes unreported. No-op when SENTRY_DSN is unset.
initErrorReporting();

// BullMQ workers run in-process (deliberate, to save a separate dyno). Worker
// entry modules are imported here as they land; each registers itself with
// jobs/lifecycle.ts so shutdown and failure reporting pick it up automatically.
await import('./src/workers/election-status.worker.js');
await import('./src/workers/auth-maintenance.worker.js');
await import('./src/workers/notification.worker.js');

// Background job failures have no HTTP error handler to report them; forward
// every registered worker's `failed` events to the tracker.
attachWorkerFailureReporting();

const port = ENV.PORT;
const httpServer = createServer(app);

initRealtime(httpServer);

httpServer.listen(port, () => {
  logger.info(
    ENV.NODE_ENV === 'production'
      ? `Elektor Pro API running in production on port ${port}`
      : `Elektor Pro API listening on http://localhost:${port}`,
  );
});

let shuttingDown = false;

/**
 * Coordinated graceful shutdown: stop accepting new HTTP connections and drain
 * in-flight requests, close realtime, drain the in-process workers, then close
 * the DB pool. A hard timeout forces exit so a stuck request/job can't hang
 * the deploy.
 */
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 35_000);
  forceExit.unref();

  try {
    await new Promise<void>((resolve) => httpServer.close(() => { resolve(); }));
    await closeRealtime();
    await stopWorkers();
    await closeRateLimitStore();
    await prisma.$disconnect();
    // Last: give buffered crash/error reports a bounded chance to leave.
    await flushErrorReporting();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// A rejection with no catch handler would otherwise terminate the process
// silently. Log it with context; do not exit (the process may still be healthy).
process.on('unhandledRejection', (reason) => {
  logger.error(reason, 'Unhandled promise rejection');
  reportError(reason, {
    errorId: 'unhandled-rejection',
    layer: 'process',
    severity: 'critical',
  });
});

// An uncaught exception leaves the process in an undefined state - log it and
// shut down cleanly rather than continuing to serve traffic.
process.on('uncaughtException', (error) => {
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
  void shutdown('uncaughtException');
});
