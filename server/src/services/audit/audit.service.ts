// src/services/audit/audit.service.ts
// Append-only, tamper-evident (hash-chained) audit trail.
import { GENESIS_HASH } from '../../config/constants.js';
import { chainHash } from '../../utils/crypto.js';
import type { Role } from '../../../generated/prisma/client.js';

export interface AuditEntryInput {
  action: string;
  actorId?: null | string;
  actorRole?: null | Role;
  entity: string;
  entityId?: null | string;
  ipAddress?: null | string;
  metadata?: Record<string, unknown> | null;
  userAgent?: null | string;
}

/**
 * Minimal structural client so this works with both the root client and a
 * `$transaction` client without fighting Prisma's extension generics.
 */
interface AuditClient {
  auditLog: {
    create: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<null | { hash: string }>;
  };
}

/**
 * Append an entry to the audit chain. Pass the surrounding `$transaction`
 * client when the audit must be atomic with the change it records.
 */
export const appendAudit = async (
  client: AuditClient,
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
      metadata: (entry.metadata ?? undefined) as never,
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
    action: string;
    actorId: null | string;
    actorRole: null | Role;
    createdAt: Date;
    entity: string;
    entityId: null | string;
    hash: string;
    metadata: unknown;
    prevHash: string;
    sequence: number;
  }[],
): { brokenAt?: number; valid: boolean } => {
  // entries must be ordered by sequence asc
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    const expectedPrev = i === 0 ? GENESIS_HASH : entries[i - 1]!.hash;
    if (entry.prevHash !== expectedPrev) {
      return { brokenAt: entry.sequence, valid: false };
    }
  }
  return { valid: true };
};
