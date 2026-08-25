// server.ts
import { createServer } from 'node:http';

import app from './app.js';
import ENV from './src/config/env.js';
import {
  attachWorkerFailureReporting,
  stopWorkers,
} from './src/jobs/lifecycle.js';
import { flushAnalytics, initAnalytics } from './src/lib/analytics.js';
import {
  flushErrorReporting,
  initErrorReporting,
} from './src/lib/error-reporting.js';
import prisma from './src/lib/prisma.js';
import { registerProcessHandlers } from './src/lib/process-handlers.js';
import { closeRateLimitStore } from './src/middlewares/rateLimit.js';
import { closeRealtime, initRealtime } from './src/realtime/io.js';
import logger from './src/utils/logger.js';

// Before the server starts taking traffic or workers pick up jobs, so no
// early error goes unreported. No-op when SENTRY_DSN is unset.
initErrorReporting();
// Same shape for product analytics: no-op when POSTHOG_API_KEY is unset.
initAnalytics();

// BullMQ workers run in-process (deliberate, to save a separate dyno). Worker
// entry modules are imported here; each registers itself with
// jobs/lifecycle.ts so shutdown and failure reporting pick it up automatically.
await import('./src/workers/election-status.worker.js');
await import('./src/workers/auth-maintenance.worker.js');
await import('./src/workers/notification.worker.js');
await import('./src/workers/mail.worker.js');
await import('./src/workers/import.worker.js');
await import('./src/workers/export.worker.js');

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
 * the deploy. `exitCode` is 0 for a platform signal and 1 for a crash, so the
 * platform can tell a deploy from a restart even when the drain was clean.
 */
const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully...`);

  // Shorter than the platform's SIGKILL grace period, so a hung request or
  // job is cut off here with a log line instead of killed mid-write.
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    await new Promise<void>((resolve) => httpServer.close(() => { resolve(); }));
    await closeRealtime();
    await stopWorkers();
    await closeRateLimitStore();
    await prisma.$disconnect();
    // Last: give buffered crash/error reports and events a bounded chance
    // to leave.
    await Promise.all([flushErrorReporting(), flushAnalytics()]);
    logger.info('Shutdown complete');
    process.exit(exitCode);
  } catch (error) {
    logger.error(error, 'Error during shutdown');
    await Promise.all([flushErrorReporting(), flushAnalytics()]);
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM', 0));
process.on('SIGINT', () => void shutdown('SIGINT', 0));

registerProcessHandlers({ shutdown });
