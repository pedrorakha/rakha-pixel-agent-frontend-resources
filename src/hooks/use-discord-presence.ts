"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useDiscordStore } from "@/stores/discord-store";
import { DiscordStatus } from "@/types/discord";

const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? "http://localhost:3001";

// Backend emits this shape from PresenceGateway
interface BackendPresenceUpdate {
  memberId: string;
  discordUserId: string;
  status: string;
  animation: string;
  timestamp: string | Date;
}

export function useDiscordPresence() {
  const socketRef = useRef<Socket | null>(null);
  const { setPresence, setConnected } = useDiscordStore();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    // Connect to the /presence namespace (matches backend gateway)
    const socket = io(`${WEBSOCKET_URL}/presence`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // Listen for presence updates from backend
    socket.on("presence:update", (data: BackendPresenceUpdate) => {
      const status = (data.status || "offline") as DiscordStatus;
      setPresence(data.discordUserId, {
        userId: data.memberId,
        discordId: data.discordUserId,
        status,
        customStatus: null,
        lastChanged: typeof data.timestamp === "string" ? data.timestamp : new Date(data.timestamp).toISOString(),
      });
    });

    socketRef.current = socket;
  }, [setPresence, setConnected]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, [setConnected]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: useDiscordStore((s) => s.isConnected),
    connect,
    disconnect,
  };
}
