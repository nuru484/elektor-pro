// src/services/notifications/election-announcements.service.ts
//
// Election-day announcements to voters: "voting is open" when an election
// goes IN_PROGRESS and "results are out" on publish. Delivery is best-effort
// per voter (SMS preferred, email fallback; both mock-logged in dev) and
// always summarized in the audit trail. Callers fire these AFTER their
// transaction commits - a failed batch never rolls back a status change.
import { EligibilityMode } from '../../../generated/prisma/client.js';
import ENV from '../../config/env.js';
import {
  notificationJobId,
  notificationQueue,
} from '../../jobs/notifications.queue.js';
import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { deliverNotification } from '../../workers/notification.worker.js';
import { appendAudit } from '../audit/audit.service.js';

const BATCH_SIZE = 25;

/** FRONTEND_URL without a trailing slash, so the links below never double up. */
const siteUrl = (): string => ENV.FRONTEND_URL.replace(/\/+$/, '');

/** Voters who may vote in this election, with a contact channel. */
const eligibleVotersWithContact = async (election: {
  eligibilityMode: EligibilityMode;
  id: string;
}) => {
  const where =
    election.eligibilityMode === EligibilityMode.ALL_VOTERS
      ? {}
      : election.eligibilityMode === EligibilityMode.GROUPS
        ? {
            groupMemberships: {
              some: {
                group: { electionEligibility: { some: { electionId: election.id } } },
              },
            },
          }
        : { voterElections: { some: { electionId: election.id, isEligible: true } } };
  return prisma.voter.findMany({
    select: { email: true, id: true, name: true, phoneNumber: true },
    where: {
      ...where,
      OR: [{ phoneNumber: { not: null } }, { email: { not: null } }],
    },
  });
};

/**
 * Hand every recipient to the notification queue - one job each, so each
 * message retries on its own schedule and a provider rate limit slows
 * delivery instead of losing it.
 *
 * When Redis is not configured the queue does not exist, and delivery falls
 * back to an inline loop. That keeps the system working without Redis
 * (development, CI, and any deployment without Redis) at the cost of the
 * retries - the honest trade, and logged so an operator can see which mode
 * a blast ran in.
 */
const deliverToAll = async (
  kind: string,
  electionId: string,
  voters: { email: null | string; id: string; name: string; phoneNumber: null | string }[],
  subject: string,
  message: string,
  link: string,
): Promise<{ attempted: number; failed: number; queued: boolean }> => {
  const queue = notificationQueue();

  if (queue) {
    // A stable job id per recipient makes a repeated announcement a no-op
    // rather than a second text to the entire roll.
    await queue.addBulk(
      voters.map((voter) => ({
        data: {
          electionId,
          email: voter.email,
          link,
          name: voter.name,
          phoneNumber: voter.phoneNumber,
          subject,
          text: message,
        },
        name: kind,
        opts: { jobId: notificationJobId(kind, electionId, voter.id) },
      })),
    );
    // Queued, not delivered: failures surface on the queue's failed set and
    // through the worker's error reporting, not in this return value.
    return { attempted: voters.length, failed: 0, queued: true };
  }

  let failed = 0;
  for (let start = 0; start < voters.length; start += BATCH_SIZE) {
    const batch = voters.slice(start, start + BATCH_SIZE);
    const outcomes = await Promise.allSettled(
      batch.map(async (voter) => {
        await deliverNotification({
          electionId,
          email: voter.email,
          link,
          name: voter.name,
          phoneNumber: voter.phoneNumber,
          subject,
          text: message,
        });
      }),
    );
    failed += outcomes.filter((o) => o.status === 'rejected').length;
  }
  return { attempted: voters.length, failed, queued: false };
};

/** Announce that voting has opened. Safe to call repeatedly (audited each time). */
export const announceElectionOpened = async (electionId: string): Promise<void> => {
  try {
    const election = await prisma.election.findFirst({
      select: { eligibilityMode: true, endDate: true, id: true, name: true },
      where: { id: electionId },
    });
    if (!election) return;
    const voters = await eligibleVotersWithContact(election);
    const closes = election.endDate.toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const summary = await deliverToAll(
      'election.opened',
      electionId,
      voters,
      `Voting is open: ${election.name}`,
      `Voting is now open for "${election.name}". Cast your ballot before ${closes}.`,
      `${siteUrl()}/login`,
    );
    await appendAudit(prisma, {
      action: 'election.open_announced',
      entity: 'Election',
      entityId: electionId,
      metadata: summary,
    });
  } catch (error) {
    logger.error({ electionId, error }, 'Election-open announcement failed');
  }
};

/** Announce that results are published. */
export const announceResultsPublished = async (electionId: string): Promise<void> => {
  try {
    const election = await prisma.election.findFirst({
      select: { eligibilityMode: true, id: true, name: true, slug: true },
      where: { id: electionId },
    });
    if (!election) return;
    const voters = await eligibleVotersWithContact(election);
    const resultsUrl = `${siteUrl()}/results/${election.slug}`;
    const summary = await deliverToAll(
      'results.published',
      electionId,
      voters,
      `Results are out: ${election.name}`,
      `The results of "${election.name}" have been published. See them at ${resultsUrl}.`,
      resultsUrl,
    );
    await appendAudit(prisma, {
      action: 'election.results_announced',
      entity: 'Election',
      entityId: electionId,
      metadata: summary,
    });
  } catch (error) {
    logger.error({ electionId, error }, 'Results announcement failed');
  }
};
