// src/services/domain/vetting.service.ts
//
// Nomination vetting: criteria per election, panelist scores per candidate,
// qualification decisions, and ballot-number assignment. Decisions follow an
// explicit lifecycle map; only QUALIFIED candidates reach ballots/results
// (enforced in eligibility + results, not here). Everything is audited and
// blocked on certified (locked) elections.
import { CandidateStatus, type Role } from '../../../generated/prisma/client.js';
import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { appendAudit } from '../audit/audit.service.js';
import { assertElectionUnlocked } from './election.service.js';

interface Actor {
  id: string;
  role: Role;
}

interface Ctx {
  ipAddress?: string;
  userAgent?: string;
}

/** Legal nomination lifecycle moves; re-asserting the same status is a no-op. */
const CANDIDATE_STATUS_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  [CandidateStatus.DISQUALIFIED]: [CandidateStatus.QUALIFIED, CandidateStatus.UNDER_REVIEW],
  [CandidateStatus.DRAFT]: [
    CandidateStatus.DISQUALIFIED,
    CandidateStatus.QUALIFIED,
    CandidateStatus.UNDER_REVIEW,
    CandidateStatus.WITHDRAWN,
  ],
  [CandidateStatus.QUALIFIED]: [
    CandidateStatus.DISQUALIFIED,
    CandidateStatus.UNDER_REVIEW,
    CandidateStatus.WITHDRAWN,
  ],
  [CandidateStatus.UNDER_REVIEW]: [
    CandidateStatus.DISQUALIFIED,
    CandidateStatus.QUALIFIED,
    CandidateStatus.WITHDRAWN,
  ],
  [CandidateStatus.WITHDRAWN]: [],
};

const requireCandidate = async (candidateId: string) => {
  const candidate = await prisma.candidate.findFirst({
    select: { electionId: true, id: true, name: true, portfolioId: true, status: true },
    where: { id: candidateId },
  });
  if (!candidate) throw new NotFoundError('Candidate not found');
  return candidate;
};

// --- Criteria -------------------------------------------------------------

export const listCriteria = async (electionId: string) =>
  prisma.vettingCriterion.findMany({
    include: { _count: { select: { scores: true } } },
    orderBy: { order: 'asc' },
    where: { electionId },
  });

export const createCriterion = async (
  actor: Actor,
  electionId: string,
  input: { description?: null | string; maxScore?: number; name: string; order?: number },
  ctx: Ctx = {},
) => {
  const election = await prisma.election.findFirst({
    select: { id: true },
    where: { id: electionId },
  });
  if (!election) throw new NotFoundError('Election not found');
  await assertElectionUnlocked(prisma, electionId);
  const criterion = await prisma.vettingCriterion.create({
    data: {
      description: input.description ?? null,
      electionId,
      maxScore: input.maxScore ?? 10,
      name: input.name,
      order: input.order ?? 0,
    },
  });
  await appendAudit(prisma, {
    action: 'vetting.criterion_created',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Election',
    entityId: electionId,
    ipAddress: ctx.ipAddress,
    metadata: { criterionId: criterion.id, name: input.name },
    userAgent: ctx.userAgent,
  });
  return criterion;
};

export const updateCriterion = async (
  actor: Actor,
  criterionId: string,
  input: { description?: null | string; maxScore?: number; name?: string; order?: number },
  ctx: Ctx = {},
) => {
  const existing = await prisma.vettingCriterion.findUnique({
    select: { electionId: true, id: true },
    where: { id: criterionId },
  });
  if (!existing) throw new NotFoundError('Criterion not found');
  await assertElectionUnlocked(prisma, existing.electionId);
  const criterion = await prisma.vettingCriterion.update({
    data: input,
    where: { id: criterionId },
  });
  await appendAudit(prisma, {
    action: 'vetting.criterion_updated',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Election',
    entityId: existing.electionId,
    ipAddress: ctx.ipAddress,
    metadata: { criterionId },
    userAgent: ctx.userAgent,
  });
  return criterion;
};

export const deleteCriterion = async (
  actor: Actor,
  criterionId: string,
  ctx: Ctx = {},
): Promise<void> => {
  const existing = await prisma.vettingCriterion.findUnique({
    select: { electionId: true, id: true, name: true },
    where: { id: criterionId },
  });
  if (!existing) throw new NotFoundError('Criterion not found');
  await assertElectionUnlocked(prisma, existing.electionId);
  await prisma.vettingCriterion.delete({ where: { id: criterionId } });
  await appendAudit(prisma, {
    action: 'vetting.criterion_deleted',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Election',
    entityId: existing.electionId,
    ipAddress: ctx.ipAddress,
    metadata: { criterionId, name: existing.name },
    userAgent: ctx.userAgent,
  });
};

// --- Scoring --------------------------------------------------------------

/**
 * Auto-decision: when the election defines a vetting pass mark and every
 * criterion carries at least one score, the candidate's total percentage
 * decides qualification. Only pending candidates (DRAFT / UNDER_REVIEW) and
 * earlier AUTO decisions are re-evaluated - a human's explicit decision
 * (including withdrawal) is never overridden by a score.
 */
const AUTO_NOTE_PREFIX = 'Auto decision:';

const maybeAutoDecide = async (
  actor: Actor,
  candidateId: string,
  ctx: Ctx,
): Promise<void> => {
  const candidate = await prisma.candidate.findUnique({
    select: { electionId: true, name: true, status: true, vettingNote: true },
    where: { id: candidateId },
  });
  if (!candidate) return;
  const pending =
    candidate.status === CandidateStatus.DRAFT ||
    candidate.status === CandidateStatus.UNDER_REVIEW ||
    (candidate.vettingNote?.startsWith(AUTO_NOTE_PREFIX) ?? false);
  if (!pending) return;

  const election = await prisma.election.findUnique({
    select: { vettingPassPercent: true },
    where: { id: candidate.electionId },
  });
  const passPercent = election?.vettingPassPercent;
  if (passPercent == null) return;

  const vetting = await getCandidateVetting(candidateId);
  if (vetting.maxTotal === 0) return;
  if (vetting.byCriterion.some((entry) => entry.average === null)) return;

  const percent = (vetting.total / vetting.maxTotal) * 100;
  const status =
    percent >= passPercent ? CandidateStatus.QUALIFIED : CandidateStatus.DISQUALIFIED;
  if (status === candidate.status) return;

  await prisma.candidate.update({
    data: {
      reviewedAt: new Date(),
      reviewedById: actor.id,
      status,
      vettingNote: `${AUTO_NOTE_PREFIX} scored ${String(vetting.total)} of ${String(vetting.maxTotal)} (${percent.toFixed(1)}% against a ${String(passPercent)}% pass mark)`,
      ...(status === CandidateStatus.QUALIFIED ? {} : { ballotNumber: null }),
    },
    where: { id: candidateId },
  });
  await appendAudit(prisma, {
    action: `candidate.${status.toLowerCase()}`,
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Candidate',
    entityId: candidateId,
    ipAddress: ctx.ipAddress,
    metadata: {
      auto: true,
      electionId: candidate.electionId,
      name: candidate.name,
      passPercent,
      percent: Number(percent.toFixed(1)),
    },
    userAgent: ctx.userAgent,
  });
};

/**
 * Record (or revise) the actor's score for one candidate on one criterion,
 * then re-run the auto-decision if the election defines a pass mark.
 */
export const scoreCandidate = async (
  actor: Actor,
  candidateId: string,
  input: { criterionId: string; note?: null | string; score: number },
  ctx: Ctx = {},
) => {
  const candidate = await requireCandidate(candidateId);
  await assertElectionUnlocked(prisma, candidate.electionId);
  const criterion = await prisma.vettingCriterion.findUnique({
    select: { electionId: true, maxScore: true },
    where: { id: input.criterionId },
  });
  if (criterion?.electionId !== candidate.electionId) {
    throw new BadRequestError('Criterion does not belong to this election', {
      code: 'CRITERION_MISMATCH',
      layer: 'vetting',
    });
  }
  if (input.score < 0 || input.score > criterion.maxScore) {
    throw new BadRequestError(
      `Score must be between 0 and ${String(criterion.maxScore)}`,
      { code: 'SCORE_OUT_OF_RANGE', layer: 'vetting' },
    );
  }
  const score = await prisma.vettingScore.upsert({
    create: {
      candidateId,
      criterionId: input.criterionId,
      note: input.note ?? null,
      score: input.score,
      scoredById: actor.id,
    },
    update: { note: input.note ?? null, score: input.score },
    where: {
      candidateId_criterionId_scoredById: {
        candidateId,
        criterionId: input.criterionId,
        scoredById: actor.id,
      },
    },
  });
  await maybeAutoDecide(actor, candidateId, ctx);
  return score;
};

/** The full vetting picture for one candidate: criteria, scores, totals. */
export const getCandidateVetting = async (candidateId: string) => {
  const candidate = await requireCandidate(candidateId);
  const [criteria, scores] = await Promise.all([
    prisma.vettingCriterion.findMany({
      orderBy: { order: 'asc' },
      where: { electionId: candidate.electionId },
    }),
    prisma.vettingScore.findMany({
      include: { scoredBy: { select: { firstName: true, id: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' },
      where: { candidateId },
    }),
  ]);

  // Average per criterion across panelists, plus the grand total.
  const byCriterion = criteria.map((criterion) => {
    const criterionScores = scores.filter((s) => s.criterionId === criterion.id);
    const average =
      criterionScores.length > 0
        ? criterionScores.reduce((sum, s) => sum + s.score, 0) / criterionScores.length
        : null;
    return {
      average: average === null ? null : Number(average.toFixed(2)),
      criterion,
      scores: criterionScores,
    };
  });
  const scored = byCriterion.filter((c) => c.average !== null);
  const total = Number(
    scored.reduce((sum, c) => sum + (c.average ?? 0), 0).toFixed(2),
  );
  const maxTotal = criteria.reduce((sum, c) => sum + c.maxScore, 0);

  return { byCriterion, candidateId: candidate.id, maxTotal, total };
};

// --- Decisions ------------------------------------------------------------

export const decideCandidate = async (
  actor: Actor,
  candidateId: string,
  status: CandidateStatus,
  note: null | string | undefined,
  ctx: Ctx = {},
) => {
  const candidate = await requireCandidate(candidateId);
  await assertElectionUnlocked(prisma, candidate.electionId);
  if (
    candidate.status !== status &&
    !CANDIDATE_STATUS_TRANSITIONS[candidate.status].includes(status)
  ) {
    throw new BadRequestError(
      `A candidate cannot move from ${candidate.status} to ${status}`,
      { code: 'INVALID_CANDIDATE_TRANSITION', layer: 'vetting' },
    );
  }
  const updated = await prisma.candidate.update({
    data: {
      reviewedAt: new Date(),
      reviewedById: actor.id,
      status,
      vettingNote: note ?? null,
      // Losing qualification also vacates the ballot position.
      ...(status === CandidateStatus.QUALIFIED ? {} : { ballotNumber: null }),
    },
    select: { id: true, status: true },
    where: { id: candidateId },
  });
  await appendAudit(prisma, {
    action: `candidate.${status.toLowerCase()}`,
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Candidate',
    entityId: candidateId,
    ipAddress: ctx.ipAddress,
    metadata: { electionId: candidate.electionId, name: candidate.name, note: note ?? null },
    userAgent: ctx.userAgent,
  });
  return updated;
};

// --- Ballot numbers -------------------------------------------------------

export const setBallotNumber = async (
  actor: Actor,
  candidateId: string,
  ballotNumber: null | number,
  ctx: Ctx = {},
) => {
  const candidate = await requireCandidate(candidateId);
  await assertElectionUnlocked(prisma, candidate.electionId);
  if (ballotNumber !== null && candidate.status !== CandidateStatus.QUALIFIED) {
    throw new BadRequestError('Only qualified candidates get a ballot number', {
      code: 'NOT_QUALIFIED',
      layer: 'vetting',
    });
  }
  if (ballotNumber !== null) {
    const taken = await prisma.candidate.findFirst({
      select: { name: true },
      where: {
        ballotNumber,
        id: { not: candidateId },
        portfolioId: candidate.portfolioId,
      },
    });
    if (taken) {
      throw new ConflictError(
        `Ballot number ${String(ballotNumber)} is already taken by ${taken.name}`,
        { code: 'BALLOT_NUMBER_TAKEN', layer: 'vetting' },
      );
    }
  }
  const updated = await prisma.candidate.update({
    data: { ballotNumber },
    select: { ballotNumber: true, id: true },
    where: { id: candidateId },
  });
  await appendAudit(prisma, {
    action: 'candidate.ballot_number_set',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Candidate',
    entityId: candidateId,
    ipAddress: ctx.ipAddress,
    metadata: { ballotNumber, name: candidate.name },
    userAgent: ctx.userAgent,
  });
  return updated;
};

export type BallotNumberStrategy = 'ALPHABETICAL' | 'SCORE';

/**
 * Assign 1..n per portfolio to every QUALIFIED candidate, ordered by total
 * vetting score (highest first, name as tiebreak) or alphabetically.
 * Overwrites existing numbers so a re-run always yields a consistent set.
 */
export const autoAssignBallotNumbers = async (
  actor: Actor,
  electionId: string,
  strategy: BallotNumberStrategy,
  ctx: Ctx = {},
): Promise<{ assigned: number }> => {
  const election = await prisma.election.findFirst({
    select: { id: true },
    where: { id: electionId },
  });
  if (!election) throw new NotFoundError('Election not found');
  await assertElectionUnlocked(prisma, electionId);

  const candidates = await prisma.candidate.findMany({
    select: { id: true, name: true, portfolioId: true },
    where: { electionId, status: CandidateStatus.QUALIFIED },
  });
  const totals = new Map<string, number>();
  if (strategy === 'SCORE') {
    const grouped = await prisma.vettingScore.groupBy({
      _avg: { score: true },
      by: ['candidateId', 'criterionId'],
      where: { candidate: { electionId } },
    });
    for (const row of grouped) {
      totals.set(row.candidateId, (totals.get(row.candidateId) ?? 0) + (row._avg.score ?? 0));
    }
  }

  const byPortfolio = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const list = byPortfolio.get(candidate.portfolioId) ?? [];
    list.push(candidate);
    byPortfolio.set(candidate.portfolioId, list);
  }

  let assigned = 0;
  await prisma.$transaction(async (tx) => {
    // Clear first so re-numbering never trips the per-portfolio unique index.
    await tx.candidate.updateMany({
      data: { ballotNumber: null },
      where: { electionId },
    });
    for (const list of byPortfolio.values()) {
      const ordered = [...list].sort((a, b) =>
        strategy === 'SCORE'
          ? (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) ||
            a.name.localeCompare(b.name)
          : a.name.localeCompare(b.name),
      );
      for (const [index, candidate] of ordered.entries()) {
        await tx.candidate.update({
          data: { ballotNumber: index + 1 },
          where: { id: candidate.id },
        });
        assigned += 1;
      }
    }
    await appendAudit(tx, {
      action: 'election.ballot_numbers_assigned',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Election',
      entityId: electionId,
      ipAddress: ctx.ipAddress,
      metadata: { assigned, strategy },
      userAgent: ctx.userAgent,
    });
  });
  return { assigned };
};
