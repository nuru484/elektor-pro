import type { TxClient } from '../../types/prisma.types.js';

import {
  BallotEntryType,
  ElectionStatus,
  VotingMethod,
} from '../../../generated/prisma/client.js';
// src/services/voting/voting.service.ts
// Secret-ballot casting. Ballots are anonymous (never linked to the voter);
// turnout/one-person-one-vote is tracked separately on VoterElection. Each
// ballot is hash-chained and yields a receipt the voter can verify with.
import { GENESIS_HASH } from '../../config/constants.js';
import prisma from '../../lib/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from '../../middlewares/error-handler.js';
import { emitElectionUpdate } from '../../realtime/io.js';
import { chainHash, generateReceiptCode } from '../../utils/crypto.js';
import {
  assertVoterEligibleForElection,
  resolveEligiblePortfolios,
} from './eligibility.service.js';

export interface BallotSelection {
  approve?: boolean;
  candidateIds?: string[];
  portfolioId: string;
  type?: BallotEntryType;
}

const getVoterByUserId = async (userId: string) => {
  const voter = await prisma.voter.findFirst({ where: { userId } });
  if (!voter) throw new NotFoundError('Voter profile not found');
  return voter;
};

const assertVotingOpen = (election: {
  endDate: Date;
  startDate: Date;
  status: ElectionStatus;
}): void => {
  if (election.status !== ElectionStatus.IN_PROGRESS) {
    throw new BadRequestError('Election is not currently open for voting');
  }
  const now = new Date();
  if (now < election.startDate || now > election.endDate) {
    throw new BadRequestError('Election is not within its voting window');
  }
};

/** Get the ballot a voter sees: their eligible portfolios + voting status. */
export const getVoterBallot = async (userId: string, electionId: string) => {
  const voter = await getVoterByUserId(userId);
  const election = await prisma.election.findFirst({ where: { id: electionId } });
  if (!election) throw new NotFoundError('Election not found');

  const voterElection = await prisma.voterElection.findUnique({
    where: { voterId_electionId: { electionId, voterId: voter.id } },
  });
  await assertVoterEligibleForElection(voter.id, election, voterElection);

  const portfolios = await resolveEligiblePortfolios(voter.id, electionId);
  return {
    accreditationRequired: election.accreditationRequired,
    accredited: Boolean(voterElection?.accreditedAt),
    election: {
      description: election.description,
      endDate: election.endDate,
      id: election.id,
      name: election.name,
      slug: election.slug,
      startDate: election.startDate,
      status: election.status,
    },
    hasVoted: Boolean(voterElection?.hasVoted),
    portfolios,
  };
};

interface NormalizedEntry {
  approve: boolean | null;
  candidateId: null | string;
  portfolioId: string;
  type: BallotEntryType;
}

/** Deterministic, order-independent entry projection for hashing. */
const hashEntries = (entries: NormalizedEntry[]) =>
  [...entries]
    .sort((a, b) =>
      `${a.portfolioId}:${a.candidateId ?? ''}`.localeCompare(
        `${b.portfolioId}:${b.candidateId ?? ''}`,
      ),
    )
    .map((e) => ({ a: e.approve, c: e.candidateId, p: e.portfolioId, t: e.type }));

const normalizeSelection = (
  portfolio: { allowAbstain: boolean; candidateIds: Set<string>; maxSelections: number; votingMethod: string },
  selection: BallotSelection,
): NormalizedEntry[] => {
  const type = selection.type ?? BallotEntryType.VOTE;

  if (type === BallotEntryType.SKIP) {
    return [{ approve: null, candidateId: null, portfolioId: selection.portfolioId, type }];
  }
  if (type === BallotEntryType.ABSTAIN) {
    if (!portfolio.allowAbstain) {
      throw new BadRequestError('Abstaining is not allowed for this portfolio');
    }
    return [{ approve: null, candidateId: null, portfolioId: selection.portfolioId, type }];
  }

  const candidateIds = selection.candidateIds ?? [];
  for (const id of candidateIds) {
    if (!portfolio.candidateIds.has(id)) {
      throw new BadRequestError('Candidate does not belong to this portfolio');
    }
  }

  if (portfolio.votingMethod === VotingMethod.YES_NO) {
    if (candidateIds.length !== 1 || typeof selection.approve !== 'boolean') {
      throw new BadRequestError('A yes/no portfolio needs one nominee and an approve flag');
    }
    return [
      {
        approve: selection.approve,
        candidateId: candidateIds[0],
        portfolioId: selection.portfolioId,
        type,
      },
    ];
  }

  if (portfolio.votingMethod === VotingMethod.SINGLE_CHOICE && candidateIds.length !== 1) {
    throw new BadRequestError('Select exactly one candidate for this portfolio');
  }
  if (
    portfolio.votingMethod === VotingMethod.MULTI_SELECT &&
    (candidateIds.length < 1 || candidateIds.length > portfolio.maxSelections)
  ) {
    throw new BadRequestError(
      `Select between 1 and ${portfolio.maxSelections} candidates`,
    );
  }

  return candidateIds.map((candidateId) => ({
    approve: null,
    candidateId,
    portfolioId: selection.portfolioId,
    type: BallotEntryType.VOTE,
  }));
};

const createBallotInTx = async (
  tx: TxClient,
  electionId: string,
  entries: NormalizedEntry[],
): Promise<{ receiptCode: string }> => {
  const last = await tx.ballot.findFirst({
    orderBy: { sequence: 'desc' },
    select: { hash: true, sequence: true },
    where: { electionId },
  });
  const sequence = (last?.sequence ?? 0) + 1;
  const prevHash = last?.hash ?? GENESIS_HASH;
  const receiptCode = generateReceiptCode();
  const castAt = new Date();
  const hash = chainHash(prevHash, {
    castAt: castAt.toISOString(),
    electionId,
    entries: hashEntries(entries),
    sequence,
  });

  const ballot = await tx.ballot.create({
    data: { castAt, electionId, hash, prevHash, receiptCode, sequence },
    select: { id: true },
  });
  await tx.ballotEntry.createMany({
    data: entries.map((e) => ({
      approve: e.approve,
      ballotId: ballot.id,
      candidateId: e.candidateId,
      portfolioId: e.portfolioId,
      type: e.type,
    })),
  });
  return { receiptCode };
};

/** Cast a secret ballot. Idempotent: a voter can vote at most once per election. */
export const castBallot = async (
  userId: string,
  electionId: string,
  selections: BallotSelection[],
): Promise<{ receiptCode: string }> => {
  const voter = await getVoterByUserId(userId);
  const election = await prisma.election.findFirst({ where: { id: electionId } });
  if (!election) throw new NotFoundError('Election not found');
  assertVotingOpen(election);

  const voterElection = await prisma.voterElection.findUnique({
    where: { voterId_electionId: { electionId, voterId: voter.id } },
  });
  await assertVoterEligibleForElection(voter.id, election, voterElection);
  if (election.accreditationRequired && !voterElection?.accreditedAt) {
    throw new ForbiddenError('You must be accredited before voting');
  }

  const eligible = await resolveEligiblePortfolios(voter.id, electionId);
  const portfolioMeta = new Map(
    eligible.map((p) => [
      p.id,
      {
        allowAbstain: p.allowAbstain,
        candidateIds: new Set(p.candidates.map((c) => c.id)),
        maxSelections: p.maxSelections,
        votingMethod: p.votingMethod,
      },
    ]),
  );

  // Require a decision for every eligible portfolio (no partial ballots).
  const selectedIds = new Set(selections.map((s) => s.portfolioId));
  if (selectedIds.size !== eligible.length) {
    throw new BadRequestError('A decision is required for every portfolio');
  }

  const entries: NormalizedEntry[] = [];
  for (const selection of selections) {
    const meta = portfolioMeta.get(selection.portfolioId);
    if (!meta) throw new BadRequestError('Portfolio is not on your ballot');
    entries.push(...normalizeSelection(meta, selection));
  }

  // Retry on the (rare) ballot-sequence race.
  let result: undefined | { receiptCode: string };
  for (let attempt = 0; attempt < 3 && !result; attempt += 1) {
    try {
      result = await prisma.$transaction(async (tx) => {
        // Ensure a VoterElection row exists (ALL_VOTERS mode may not have one).
        await tx.voterElection.upsert({
          create: { electionId, voterId: voter.id },
          update: {},
          where: { voterId_electionId: { electionId, voterId: voter.id } },
        });
        // Atomic one-person-one-vote guard.
        const guard = await tx.voterElection.updateMany({
          data: { hasVoted: true, votedAt: new Date() },
          where: { electionId, hasVoted: false, voterId: voter.id },
        });
        if (guard.count !== 1) {
          throw new ConflictError('You have already voted in this election');
        }
        return createBallotInTx(tx, electionId, entries);
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2002' && attempt < 2) continue; // sequence/hash race — retry
      throw error;
    }
  }

  if (!result) {
    // Unreachable: the loop either sets result or throws. Kept as a typed
    // guard so the compiler (and a future refactor) can't silently return
    // undefined from a vote cast.
    throw new InternalServerError('Ballot could not be recorded');
  }

  emitElectionUpdate(electionId, 'results:invalidate', { electionId });
  return result;
};

/**
 * Re-derive an election's entire ballot chain, the counterpart of the audit
 * log's /verify: every ballot must link to its predecessor (sequence is
 * contiguous from 1, prevHash matches, and the stored hash recomputes from the
 * stored entries). Public by design - anyone may prove no ballot was inserted,
 * removed, or altered. Loads the whole chain; fine at institutional scale.
 */
export const verifyBallotChain = async (idOrSlug: string) => {
  const election = await prisma.election.findFirst({
    select: { id: true },
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
  if (!election) throw new NotFoundError('Election not found');

  const ballots = await prisma.ballot.findMany({
    orderBy: { sequence: 'asc' },
    select: {
      castAt: true,
      entries: {
        select: { approve: true, candidateId: true, portfolioId: true, type: true },
      },
      hash: true,
      prevHash: true,
      sequence: true,
    },
    where: { electionId: election.id },
  });

  for (let i = 0; i < ballots.length; i += 1) {
    const ballot = ballots[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : ballots[i - 1].hash;
    const recomputed = chainHash(ballot.prevHash, {
      castAt: ballot.castAt.toISOString(),
      electionId: election.id,
      entries: hashEntries(ballot.entries),
      sequence: ballot.sequence,
    });
    if (
      ballot.sequence !== i + 1 ||
      ballot.prevHash !== expectedPrev ||
      recomputed !== ballot.hash
    ) {
      return {
        brokenAt: ballot.sequence,
        electionId: election.id,
        total: ballots.length,
        valid: false,
      };
    }
  }
  return { electionId: election.id, total: ballots.length, valid: true };
};

/** Verify a ballot by its receipt code, proving inclusion + chain integrity. */
export const verifyReceipt = async (idOrSlug: string, receiptCode: string) => {
  // Slug-friendly like the chain verify: public pages address elections by slug.
  const election = await prisma.election.findFirst({
    select: { id: true },
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
  if (!election) throw new NotFoundError('Election not found');
  const electionId = election.id;
  const ballot = await prisma.ballot.findFirst({
    include: {
      entries: {
        include: {
          candidate: { select: { name: true } },
          portfolio: { select: { name: true } },
        },
      },
    },
    where: { electionId, receiptCode },
  });
  if (!ballot) throw new NotFoundError('No ballot found for that receipt');

  const recomputed = chainHash(ballot.prevHash, {
    castAt: ballot.castAt.toISOString(),
    electionId,
    entries: hashEntries(ballot.entries),
    sequence: ballot.sequence,
  });

  return {
    castAt: ballot.castAt,
    choices: ballot.entries.map((e) => ({
      approve: e.approve,
      candidate: e.candidate?.name ?? null,
      portfolio: e.portfolio.name,
      type: e.type,
    })),
    integrityValid: recomputed === ballot.hash,
    receiptCode: ballot.receiptCode,
    sequence: ballot.sequence,
  };
};
