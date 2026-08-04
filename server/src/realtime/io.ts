// src/realtime/io.ts
// Socket.IO singleton for live results / dashboard updates.
import type { Server as HttpServer } from 'node:http';

import { Server as SocketServer } from 'socket.io';

import ENV from '../config/env.js';
import logger from '../utils/logger.js';

let io: SocketServer | undefined;

const electionRoom = (electionId: string): string => `election:${electionId}`;

/**
 * Room subscriptions are unauthenticated (results pages are public and the
 * only event payload is an "invalidate" ping), but the room name is
 * client-supplied - so it is validated to id-shaped input to keep arbitrary
 * strings out of the room registry.
 */
const isValidElectionId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 64 &&
  /^[A-Za-z0-9_-]+$/.test(value);

export const initRealtime = (httpServer: HttpServer): SocketServer => {
  const allowedOrigins = ENV.CORS_ACCESS.split(',').map((o) => o.trim());
  io = new SocketServer(httpServer, {
    cors: { credentials: true, methods: ['GET', 'POST'], origin: allowedOrigins },
  });

  io.on('connection', (socket) => {
    socket.on('election:subscribe', (electionId: unknown) => {
      if (isValidElectionId(electionId)) {
        void socket.join(electionRoom(electionId));
      }
    });
    socket.on('election:unsubscribe', (electionId: unknown) => {
      if (isValidElectionId(electionId)) {
        void socket.leave(electionRoom(electionId));
      }
    });
  });

  logger.info('Realtime (Socket.IO) initialized');
  return io;
};

/** Emit a live results/turnout update to everyone watching an election. */
export const emitElectionUpdate = (
  electionId: string,
  event: string,
  payload: unknown,
): void => {
  io?.to(electionRoom(electionId)).emit(event, payload);
};

export const closeRealtime = async (): Promise<void> => {
  if (io) {
    await io.close();
    io = undefined;
  }
};
