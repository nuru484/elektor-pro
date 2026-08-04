// src/services/domain/election-scheduler.service.ts
//
// The election lifecycle sweep: opens SCHEDULED elections whose window has
// started and closes running ones whose window has ended. Runs from the
// BullMQ scheduler every minute; manual status changes by admins always
// remain possible (PAUSED and CANCELLED are never touched). Every automatic
// transition is audited.
import { ElectionStatus } from '../../../generated/prisma/client.js';
import prisma from '../../lib/prisma.js';
import { appendAudit } from '../audit/audit.service.js';
import { announceElectionOpened } from '../notifications/election-announcements.service.js';

export interface SweepResult {
  closed: number;
  opened: number;
}

export const sweepElectionStatuses = async (
  now = new Date(),
): Promise<SweepResult> => {
  // Elections are few; per-row transactions keep each transition atomic with
  // its audit entry, and a guarded updateMany makes the sweep re-entrant.
  const dueToOpen = await prisma.election.findMany({
    select: { id: true, name: true },
    where: {
      endDate: { gt: now },
      startDate: { lte: now },
      status: ElectionStatus.SCHEDULED,
    },
  });
  let opened = 0;
  for (const election of dueToOpen) {
    const didOpen = await prisma.$transaction(async (tx) => {
      const guard = await tx.election.updateMany({
        data: { status: ElectionStatus.IN_PROGRESS },
        where: { id: election.id, status: ElectionStatus.SCHEDULED },
      });
      if (guard.count !== 1) return false;
      opened += 1;
      await appendAudit(tx, {
        action: 'election.auto_opened',
        entity: 'Election',
        entityId: election.id,
        metadata: { name: election.name },
      });
      return true;
    });
    // After commit: tell the eligible voters (best-effort, never blocking).
    if (didOpen) void announceElectionOpened(election.id);
  }

  const dueToClose = await prisma.election.findMany({
    select: { id: true, name: true },
    where: {
      endDate: { lte: now },
      status: { in: [ElectionStatus.SCHEDULED, ElectionStatus.IN_PROGRESS] },
    },
  });
  let closed = 0;
  for (const election of dueToClose) {
    await prisma.$transaction(async (tx) => {
      const guard = await tx.election.updateMany({
        data: { status: ElectionStatus.ENDED },
        where: {
          id: election.id,
          status: { in: [ElectionStatus.SCHEDULED, ElectionStatus.IN_PROGRESS] },
        },
      });
      if (guard.count !== 1) return;
      closed += 1;
      await appendAudit(tx, {
        action: 'election.auto_closed',
        entity: 'Election',
        entityId: election.id,
        metadata: { name: election.name },
      });
    });
  }

  return { closed, opened };
};
