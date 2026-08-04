"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { socketUrl } from "@/lib/env";

/**
 * Subscribe to live updates for an election. Calls `onUpdate` whenever the
 * server signals results changed (e.g. a ballot was cast).
 */
export function useElectionSocket(electionId: string | undefined, onUpdate: () => void) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!electionId) return;
    const socket: Socket = io(socketUrl, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("election:subscribe", electionId);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("results:invalidate", onUpdate);

    return () => {
      socket.emit("election:unsubscribe", electionId);
      socket.disconnect();
    };
    // onUpdate is stable (RTK refetch); intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electionId]);

  return { connected };
}
