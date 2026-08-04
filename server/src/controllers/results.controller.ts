// src/controllers/results.controller.ts
import type { Request, Response } from 'express';

import prisma from '../lib/prisma.js';
import { asyncHandler, NotFoundError } from '../middlewares/error-handler.js';
import {
  exportResultsCsv,
  exportResultsPdf,
} from '../services/results/export.service.js';
import {
  certifyResults,
  getCertification,
  publishResults,
} from '../services/results/results-admin.service.js';
import {
  assertCanViewResults,
  computeResults,
  type ResultsViewer,
} from '../services/results/results.service.js';
import { requestContextOf } from '../utils/auth-session.js';
import { sendOk } from '../utils/http.js';
import { actorOf } from './proposal-response.js';

const viewerOf = (req: Request): null | ResultsViewer =>
  req.user ? { id: req.user.id, role: req.user.role } : null;

const loadElectionForResults = async (idOrSlug: string) => {
  const election = await prisma.election.findFirst({
    select: {
      id: true,
      resultsPolicy: true,
      resultsPublishedAt: true,
      settings: true,
      status: true,
    },
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
  if (!election) throw new NotFoundError('Election not found');
  return election;
};

export const getResultsController = asyncHandler(
  async (req: Request, res: Response) => {
    const election = await loadElectionForResults(req.params.electionId);
    await assertCanViewResults(viewerOf(req), election);
    sendOk(res, 'Results retrieved', await computeResults(election.id));
  },
);

export const exportResultsController = asyncHandler(
  async (req: Request, res: Response) => {
    const election = await loadElectionForResults(req.params.electionId);
    await assertCanViewResults(viewerOf(req), election);
    const format = req.query.format === 'pdf' ? 'pdf' : 'csv';

    if (format === 'pdf') {
      const pdf = await exportResultsPdf(election.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="results.pdf"');
      res.send(pdf);
      return;
    }
    const csv = await exportResultsCsv(election.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
    res.send(csv);
  },
);

export const publishResultsController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await publishResults(
      actorOf(req),
      req.params.electionId,
      requestContextOf(req),
    );
    sendOk(res, 'Results published', data);
  },
);

export const certifyResultsController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await certifyResults(
      actorOf(req),
      req.params.electionId,
      requestContextOf(req),
    );
    sendOk(res, 'Results certified', data);
  },
);

export const getCertificationController = asyncHandler(
  async (req: Request, res: Response) => {
    // The snapshot carries the full tally, so it is gated by the same
    // visibility rules as the live results endpoint.
    const election = await loadElectionForResults(req.params.electionId);
    await assertCanViewResults(viewerOf(req), election);
    const data = await getCertification(election.id);
    sendOk(res, 'Certification retrieved', data);
  },
);
