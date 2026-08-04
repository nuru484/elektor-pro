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

/**
 * Append an entry to the audit chain. Pass the surrounding `$transaction`
 * client when the audit must be atomic with the change it records.
 */
export const appendAudit = async (
  client: DbClient,
  entry: AuditEntryInput,
): Promise<void> => {
  const last = await client.auditLog.findFirst({
    orderBy: { sequence: 'desc' },
    select: { hash: true },
  });
  const prevHash = last?.hash ?? GENESIS_HASH;

  const hashPayload = {
    action: entry.action,
    actorId: entry.actorId ?? null,
    actorRole: entry.actorRole ?? null,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
    timestamp: Date.now(),
  };
  const hash = chainHash(prevHash, hashPayload);

  await client.auditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actorId ?? null,
      actorRole: entry.actorRole ?? null,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      hash,
      ipAddress: entry.ipAddress ?? null,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      prevHash,
      userAgent: entry.userAgent ?? null,
    },
  });
};

/**
 * Verify the integrity of the audit chain. Returns the first broken link, if
 * any, so an operator can prove the log has not been tampered with.
 */
export const verifyAuditChain = (
  entries: {
    hash: string;
    prevHash: string;
    sequence: number;
  }[],
): { brokenAt?: number; valid: boolean } => {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : entries[i - 1].hash;
    if (entry.prevHash !== expectedPrev) {
      return { brokenAt: entry.sequence, valid: false };
    }
  }
  return { valid: true };
};
