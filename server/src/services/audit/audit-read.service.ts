import type { Prisma } from '../../../generated/prisma/client.js';

// src/services/audit/audit-read.service.ts
import prisma from '../../lib/prisma.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';
import { verifyAuditChain } from './audit.service.js';

const AUDIT_INCLUDE = {
  actor: { select: { firstName: true, id: true, lastName: true, role: true } },
} as const;

export const listAuditLogs = async (
  filters: { action?: string; actorId?: string; entity?: string },
  pagination: PaginationParams,
) => {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.action ? { action: { contains: filters.action } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: AUDIT_INCLUDE,
      orderBy: { sequence: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      where,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

/** Verify the integrity of the entire audit chain. */
export const verifyAuditIntegrity = async () => {
  const entries = await prisma.auditLog.findMany({
    orderBy: { sequence: 'asc' },
    select: { hash: true, prevHash: true, sequence: true },
  });
  return { ...verifyAuditChain(entries), total: entries.length };
};
