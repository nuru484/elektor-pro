import type { Prisma, Role } from '../../../generated/prisma/client.js';

// src/services/audit/audit.service.ts
// Append-only, tamper-evident (hash-chained) audit trail.
import { GENESIS_HASH } from '../../config/constants.js';
import prisma from '../../lib/prisma.js';
import { chainHash } from '../../utils/crypto.js';

export interface AuditEntryInput {
  action: string;
  actorId?: null | string;
  actorRole?: null | Role;
  entity: string;
  entityId?: null | string;
  ipAddress?: null | string;
  metadata?: null | Record<string, unknown>;
  userAgent?: null | string;
}

/** Accepts both the root client and a `$transaction` client. */
type DbClient =
  | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
  | typeof prisma;

type TxOnlyClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * A single Postgres advisory-lock key for the whole audit chain. Appends must
 * be serialised: two concurrent callers otherwise read the same "last" hash
 * and both write rows claiming it as their `prevHash`, which permanently
 * breaks verification (the sequence is an autoincrement, so there is no
 * unique constraint to catch the collision the way the ballot chain has one).
 * On election day, concurrent accreditations make this the normal case.
 */
const AUDIT_LOCK_KEY = 4_919_001;

/** Row shape the chain is verified from - the full hashed payload. */
export interface AuditChainRow {
  action: string;
  actorId: null | string;
  actorRole: null | string;
  createdAt: Date;
  entity: string;
  entityId: null | string;
  hash: string;
  metadata: unknown;
  prevHash: string;
  sequence: number;
}

/**
 * The exact payload that gets hashed. Every field here is also persisted, so
 * the hash can be recomputed from the stored row - which is what makes the
 * chain tamper-EVIDENT rather than merely tamper-shaped. `createdAt` is
 * written explicitly for the same reason: hashing a timestamp that is never
 * stored would make the hashes unverifiable by construction.
 *
 * Metadata is round-tripped through JSON first so the value hashed here is
 * byte-identical to what Postgres will return on a later read (a Date in
 * metadata, for instance, serialises to a string on the way in).
 */
const hashPayloadOf = (entry: {
  action: string;
  actorId: null | string;
  actorRole: null | string;
  createdAt: Date;
  entity: string;
  entityId: null | string;
  metadata: unknown;
}): Record<string, unknown> => ({
  action: entry.action,
  actorId: entry.actorId,
  actorRole: entry.actorRole,
  entity: entry.entity,
  entityId: entry.entityId,
  metadata: entry.metadata === undefined ? null : (JSON.parse(JSON.stringify(entry.metadata)) as unknown),
  timestamp: entry.createdAt.toISOString(),
});

const appendAuditInTx = async (
  tx: TxOnlyClient,
  entry: AuditEntryInput,
): Promise<void> => {
  // Held until this transaction ends; serialises the read-then-write below.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY}::bigint)`;

  const last = await tx.auditLog.findFirst({
    orderBy: { sequence: 'desc' },
    select: { hash: true },
  });
  const prevHash = last?.hash ?? GENESIS_HASH;

  const createdAt = new Date();
  const row = {
    action: entry.action,
    actorId: entry.actorId ?? null,
    actorRole: entry.actorRole ?? null,
    createdAt,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
  };
  const hash = chainHash(prevHash, hashPayloadOf(row));

  await tx.auditLog.create({
    data: {
      ...row,
      hash,
      ipAddress: entry.ipAddress ?? null,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      prevHash,
      userAgent: entry.userAgent ?? null,
    },
  });
};

const isRootClient = (client: DbClient): client is typeof prisma =>
  typeof (client as { $transaction?: unknown }).$transaction === 'function';

/**
 * Append an entry to the audit chain. Pass the surrounding `$transaction`
 * client when the audit must be atomic with the change it records; callers
 * with the root client get their own transaction so the advisory lock always
 * has a transaction to be scoped to.
 */
export const appendAudit = async (
  client: DbClient,
  entry: AuditEntryInput,
): Promise<void> => {
  if (isRootClient(client)) {
    await client.$transaction((tx) => appendAuditInTx(tx, entry));
    return;
  }
  await appendAuditInTx(client, entry);
};

/**
 * Verify the integrity of the audit chain: every row must link to its
 * predecessor AND its stored hash must recompute from its own stored content.
 * The link check alone only proves nothing was inserted or removed - it would
 * happily pass a log whose actions, actors, or metadata had been rewritten in
 * place. Returns the first broken link so an operator can point at it.
 */
export const verifyAuditChain = (
  entries: AuditChainRow[],
): { brokenAt?: number; reason?: 'content' | 'link'; valid: boolean } => {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : entries[i - 1].hash;
    if (entry.prevHash !== expectedPrev) {
      return { brokenAt: entry.sequence, reason: 'link', valid: false };
    }
    if (chainHash(entry.prevHash, hashPayloadOf(entry)) !== entry.hash) {
      return { brokenAt: entry.sequence, reason: 'content', valid: false };
    }
  }
  return { valid: true };
};
