// src/types/prisma.types.ts
import type prisma from '../lib/prisma.js';

/** Either the root client or a transaction client. */
export type DbClient = TxClient | typeof prisma;

/** The client passed inside `prisma.$transaction(async (tx) => ...)`. */
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
