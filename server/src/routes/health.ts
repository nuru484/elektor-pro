// src/routes/health.ts
import { Router } from 'express';

import prisma from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/error-handler.js';

const healthRoutes = Router();

// Liveness — process is up.
healthRoutes.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

healthRoutes.get('/', (_req, res) => {
  res.status(200).json({ message: 'Elektor Pro API', success: true });
});

// Readiness — dependencies (database) reachable.
healthRoutes.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ database: 'up', status: 'ready' });
  }),
);

export default healthRoutes;
