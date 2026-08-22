// src/realtime/io.ts
// Socket.IO singleton for live results / dashboard updates.
import type { Server as HttpServer } from 'node:http';

import { createAdapter } from '@socket.io/redis-adapter';
import { type Redis } from 'ioredis';
import { Server as SocketServer } from 'socket.io';

import ENV from '../config/env.js';
import { createRedisConnection } from '../jobs/connection.js';
import logger from '../utils/logger.js';

let io: SocketServer | undefined;
// The adapter needs a dedicated pub/sub pair: a Redis client in subscribe
// mode cannot issue ordinary commands, so these are separate from the shared
// connection used elsewhere.
let pubClient: null | Redis = null;
let subClient: null | Redis = null;

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

  // Without an adapter, rooms live in THIS process's memory: an event emitted
  // by the instance that recorded a ballot never reaches clients connected to
  // any other instance, so live results silently go stale for most viewers
  // the moment a second instance exists. The Redis adapter fans emissions out
  // across instances and is what makes running more than one of them
  // correct. No Redis (dev, CI, single-instance deploys) keeps the in-memory
  // adapter, which is exactly right for one process.
  if (ENV.REDIS_URL) {
    pubClient = createRedisConnection();
    subClient = pubClient?.duplicate() ?? null;
    if (pubClient && subClient) {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Realtime scaled out via the Redis adapter');
    }
  }

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

/**
 * Coalesced variant for high-frequency events (a ballot landing).
 *
 * Every viewer of a results page refetches when this fires, so emitting once
 * per ballot multiplies load by the size of the audience: 60 ballots/second
 * into a room of 200 watchers is 12,000 refetches/second demanded from an
 * endpoint that serves ~115. Emitting at most once per window collapses a
 * burst into one refresh without anyone perceiving a difference, and the
 * trailing edge guarantees the LAST ballot of a burst is always announced -
 * so the final tally is never left stale on screen.
 */
const THROTTLE_MS = 1000;

interface Window {
  /** Set only when a call arrived DURING the window, so a quiet window
   *  does not re-emit the event that opened it. */
  queued?: { payload: unknown };
  timer: NodeJS.Timeout;
}

const windows = new Map<string, Window>();

export const emitElectionUpdateThrottled = (
  electionId: string,
  event: string,
  payload: unknown,
): void => {
  const key = `${electionId}:${event}`;
  const open = windows.get(key);
  if (open) {
    // Suppressed inside the open window; the newest payload wins and goes
    // out on the trailing edge. The timer keeps running so the window stays
    // honest.
    open.queued = { payload };
    return;
  }

  emitElectionUpdate(electionId, event, payload);
  const timer = setTimeout(() => {
    const finished = windows.get(key);
    windows.delete(key);
    if (finished?.queued) {
      emitElectionUpdate(electionId, event, finished.queued.payload);
    }
  }, THROTTLE_MS);
  timer.unref();
  windows.set(key, { timer });
};

/** Test-only: drop queued emissions so timers never leak between specs. */
export const _resetThrottleForTests = (): void => {
  for (const { timer } of windows.values()) clearTimeout(timer);
  windows.clear();
};

export const closeRealtime = async (): Promise<void> => {
  if (io) {
    await io.close();
    io = undefined;
  }
  await Promise.all(
    [pubClient, subClient]
      .filter((client) => client !== null)
      .map((client) => client.quit().catch(() => undefined)),
  );
  pubClient = null;
  subClient = null;
};
