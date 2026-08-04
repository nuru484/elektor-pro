import { beforeEach, describe, expect, it } from 'vitest';

import { sweepElectionStatuses } from '../../src/services/domain/election-scheduler.service.js';
import { prisma, resetDb } from '../helpers.js';

const day = 86_400_000;

const makeElection = (
  slug: string,
  status: 'IN_PROGRESS' | 'PAUSED' | 'SCHEDULED',
  startOffsetMs: number,
  endOffsetMs: number,
) =>
  prisma.election.create({
    data: {
      endDate: new Date(Date.now() + endOffsetMs),
      name: slug,
      slug,
      startDate: new Date(Date.now() + startOffsetMs),
      status,
    },
  });

describe('election status sweep', () => {
  beforeEach(resetDb);

  it('opens due SCHEDULED elections and closes expired ones, audited', async () => {
    const opens = await makeElection('opens-now', 'SCHEDULED', -60_000, day);
    const closes = await makeElection('closes-now', 'IN_PROGRESS', -2 * day, -60_000);
    const future = await makeElection('future', 'SCHEDULED', day, 2 * day);
    const paused = await makeElection('paused', 'PAUSED', -2 * day, day);

    const result = await sweepElectionStatuses();
    expect(result).toEqual({ closed: 1, opened: 1 });

    const [a, b, c, d] = await Promise.all([
      prisma.election.findUnique({ where: { id: opens.id } }),
      prisma.election.findUnique({ where: { id: closes.id } }),
      prisma.election.findUnique({ where: { id: future.id } }),
      prisma.election.findUnique({ where: { id: paused.id } }),
    ]);
    expect(a?.status).toBe('IN_PROGRESS');
    expect(b?.status).toBe('ENDED');
    expect(c?.status).toBe('SCHEDULED');
    // Manual pauses are never overridden by the sweep.
    expect(d?.status).toBe('PAUSED');

    expect(
      await prisma.auditLog.count({ where: { action: 'election.auto_opened' } }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { action: 'election.auto_closed' } }),
    ).toBe(1);

    // Re-entrant: a second sweep changes nothing.
    expect(await sweepElectionStatuses()).toEqual({ closed: 0, opened: 0 });
  });

  it('closes a SCHEDULED election that was never opened once its window passes', async () => {
    await makeElection('missed-window', 'SCHEDULED', -3 * day, -day);
    const result = await sweepElectionStatuses();
    expect(result).toEqual({ closed: 1, opened: 0 });
  });
});
