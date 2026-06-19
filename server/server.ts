// server.ts
import { createServer } from 'node:http';

import app from './app.js';
import ENV from './src/config/env.js';
import prisma from './src/lib/prisma.js';
import { closeRealtime, initRealtime } from './src/realtime/io.js';
import logger from './src/utils/logger.js';

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

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
  try {
    await closeRealtime();
    await prisma.$disconnect();
  } catch (error) {
    logger.error(error, 'Error during shutdown');
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error(reason, 'Unhandled promise rejection');
});
