// src/services/change-request/types.ts
import type { ChangeAction, ChangeEntity, Role } from '../../../generated/prisma/client.js';
import type { TxClient } from '../../types/prisma.types.js';

/**
 * Per-entity apply functions. They run inside a transaction so the change and
 * its audit entry commit atomically. Each returns the affected entity id.
 */
export interface Applier {
  create?: (tx: TxClient, payload: unknown, actorId: string) => Promise<{ id: string }>;
  remove?: (tx: TxClient, id: string, actorId: string) => Promise<{ id: string }>;
  update?: (
    tx: TxClient,
    id: string,
    payload: unknown,
    actorId: string,
  ) => Promise<{ id: string }>;
}

export interface ChangeActor {
  id: string;
  role: Role;
}

export interface ChangeContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface ProposeInput {
  action: ChangeAction;
  entity: ChangeEntity;
  entityId?: string;
  payload: unknown;
  summary?: string;
}
