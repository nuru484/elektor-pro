// src/controllers/results.controller.ts
import type { Request, Response } from 'express';

import { Capability, Role } from '../../generated/prisma/client.js';
import prisma from '../lib/prisma.js';
import {
  asyncHandler,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../middlewares/error-handler.js';
import { hasCapability } from '../services/authorization/capability.service.js';
import {
  exportResultsCsv,
  exportResultsPdf,
} from '../services/results/export.service.js';
import {
  certifyResults,
  getCertification,
  publishResults,
  unpublishResults,
} from '../services/results/results-admin.service.js';
import {
  assertCanViewResults,
  getCachedResults,
  type ResultsViewer,
} from '../services/results/results.service.js';
import { getTurnout } from '../services/voting/accreditation.service.js';
import { verifyBallotChain } from '../services/voting/voting.service.js';
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
    sendOk(res, 'Results retrieved', await getCachedResults(election.id));
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

export const unpublishResultsController = asyncHandler(
  async (req: Request, res: Response) => {
    await unpublishResults(
      actorOf(req),
      req.params.electionId,
      requestContextOf(req),
    );
    sendOk(res, 'Results unpublished', { electionId: req.params.electionId });
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

/**
 * One-page election report: turnout, accreditation, nomination pipeline, and
 * integrity - the numbers an electoral commission wants on one screen.
 * Staff and VIEW_RESULTS holders only (it exposes operational counts).
 */
export const getElectionReportController = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) throw new UnauthorizedError('Authentication required');
    const election = await loadElectionForResults(req.params.electionId);
    const isStaff = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (
      !isStaff &&
      !(await hasCapability(user, Capability.VIEW_RESULTS, election.id))
    ) {
      throw new ForbiddenError('The election report is not available to you');
    }

    const [turnout, candidateStatuses, portfolios, chain, accredited] =
      await Promise.all([
        getTurnout(election.id),
        prisma.candidate.groupBy({
          _count: { _all: true },
          by: ['status'],
          where: { electionId: election.id },
        }),
        prisma.portfolio.count({ where: { electionId: election.id } }),
        verifyBallotChain(election.id),
        prisma.voterElection.count({
          where: { accreditedAt: { not: null }, electionId: election.id },
        }),
      ]);

    sendOk(res, 'Report generated', {
      accredited,
      candidates: Object.fromEntries(
        candidateStatuses.map((row) => [row.status, row._count._all]),
      ),
      chain,
      portfolios,
      turnout,
    });
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
