// src/services/notifications/election-announcements.service.ts
//
// Election-day announcements to voters: "voting is open" when an election
// goes IN_PROGRESS and "results are out" on publish. Delivery is best-effort
// per voter (SMS preferred, email fallback; both mock-logged in dev) and
// always summarized in the audit trail. Callers fire these AFTER their
// transaction commits - a failed batch never rolls back a status change.
import { EligibilityMode } from '../../../generated/prisma/client.js';
import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { appendAudit } from '../audit/audit.service.js';
import { defaultDeps } from '../deps.js';

const BATCH_SIZE = 25;

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

const deliverToAll = async (
  voters: { email: null | string; name: string; phoneNumber: null | string }[],
  subject: string,
  message: string,
): Promise<{ attempted: number; failed: number }> => {
  let failed = 0;
  for (let start = 0; start < voters.length; start += BATCH_SIZE) {
    const batch = voters.slice(start, start + BATCH_SIZE);
    const outcomes = await Promise.allSettled(
      batch.map(async (voter) => {
        if (voter.phoneNumber) {
          await defaultDeps.sms.send(voter.phoneNumber, message);
        } else if (voter.email) {
          await defaultDeps.mail.send({
            email: voter.email,
            subject,
            text: `Hello ${voter.name},\n\n${message}`,
          });
        }
      }),
    );
    failed += outcomes.filter((o) => o.status === 'rejected').length;
  }
  return { attempted: voters.length, failed };
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
      voters,
      `Voting is open: ${election.name}`,
      `Voting is now open for "${election.name}". Cast your ballot before ${closes}.`,
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
    const summary = await deliverToAll(
      voters,
      `Results are out: ${election.name}`,
      `The results of "${election.name}" have been published. See them at /results/${election.slug}.`,
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
