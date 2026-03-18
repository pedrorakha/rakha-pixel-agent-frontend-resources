"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Character } from "@/types/character";

const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? "http://localhost:3001";

// Throttle — envia no maximo 1 update de posicao a cada THROTTLE_MS
const MOVE_THROTTLE_MS = 80;

export interface PlayerMovePayload {
  memberId: string;
  gridX: number;
  gridY: number;
  direction: Character["direction"];
  state: Character["state"];
}

export interface PlayerJumpPayload {
  memberId: string;
  gridX: number;
  gridY: number;
}

export interface PlayerLeavePayload {
  memberId: string;
}

export interface ChatMessagePayload {
  id: string;
  memberId: string;
  memberName: string;
  message: string;
  gridX: number;
  gridY: number;
  timestamp: number;
}

interface UseMultiplayerSyncOptions {
  playerId: string | null;
  onRemoteMove: (payload: PlayerMovePayload) => void;
  onRemoteJump: (payload: PlayerJumpPayload) => void;
  onChatMessage: (payload: ChatMessagePayload) => void;
  onPlayerLeave: (payload: PlayerLeavePayload) => void;
}

export function useMultiplayerSync({
  playerId,
  onRemoteMove,
  onRemoteJump,
  onChatMessage,
  onPlayerLeave,
}: UseMultiplayerSyncOptions) {
  const socketRef = useRef<Socket | null>(null);
  const lastMoveRef = useRef<number>(0);
  const [onlinePlayers, setOnlinePlayers] = useState<Set<string>>(new Set());
  const onRemoteMoveRef = useRef(onRemoteMove);
  const onRemoteJumpRef = useRef(onRemoteJump);
  const onChatMessageRef = useRef(onChatMessage);

  const onPlayerLeaveRef = useRef(onPlayerLeave);

  onRemoteMoveRef.current = onRemoteMove;
  onRemoteJumpRef.current = onRemoteJump;
  onChatMessageRef.current = onChatMessage;
  onPlayerLeaveRef.current = onPlayerLeave;

  useEffect(() => {
    const socket = io(`${WEBSOCKET_URL}/movement`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      if (playerId) {
        socket.emit("player:join", { memberId: playerId });
      }
    });

    // Outro jogador entrou
    socket.on("player:join", (data: { memberId: string }) => {
      setOnlinePlayers((prev) => {
        const next = new Set(prev);
        next.add(data.memberId);
        return next;
      });
    });

    // Movimentos de outros jogadores (tambem marca como online)
    socket.on("player:move", (data: PlayerMovePayload) => {
      setOnlinePlayers((prev) => {
        if (prev.has(data.memberId)) return prev;
        const next = new Set(prev);
        next.add(data.memberId);
        return next;
      });
      if (data.memberId === playerId) return;
      onRemoteMoveRef.current(data);
    });

    // Pulos de outros jogadores
    socket.on("player:jump", (data: PlayerJumpPayload) => {
      if (data.memberId === playerId) return;
      onRemoteJumpRef.current(data);
    });

    // Mensagens de chat (de todos, incluindo nosso proprio para confirmacao)
    socket.on("chat:message", (data: ChatMessagePayload) => {
      onChatMessageRef.current(data);
    });

    // Jogador saiu — retorna personagem a posicao baseada no Discord
    socket.on("player:leave", (data: PlayerLeavePayload) => {
      setOnlinePlayers((prev) => {
        const next = new Set(prev);
        next.delete(data.memberId);
        return next;
      });
      if (data.memberId === playerId) return;
      onPlayerLeaveRef.current(data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [playerId]);

  // Emite movimento local com throttle
  const emitMove = useCallback(
    (gridX: number, gridY: number, direction: Character["direction"], state: Character["state"]) => {
      if (!socketRef.current?.connected || !playerId) return;

      const now = Date.now();
      if (now - lastMoveRef.current < MOVE_THROTTLE_MS) return;
      lastMoveRef.current = now;

      socketRef.current.emit("player:move", {
        memberId: playerId,
        gridX,
        gridY,
        direction,
        state,
      } satisfies PlayerMovePayload);
    },
    [playerId]
  );

  // Emite pulo
  const emitJump = useCallback(
    (gridX: number, gridY: number) => {
      if (!socketRef.current?.connected || !playerId) return;

      socketRef.current.emit("player:jump", {
        memberId: playerId,
        gridX,
        gridY,
      } satisfies PlayerJumpPayload);
    },
    [playerId]
  );

  // Emite mensagem de chat
  const emitChat = useCallback(
    (memberName: string, message: string, gridX: number, gridY: number) => {
      if (!socketRef.current?.connected || !playerId) return;
      if (!message.trim()) return;

      socketRef.current.emit("chat:message", {
        memberId: playerId,
        memberName,
        message: message.trim().slice(0, 200),
        gridX,
        gridY,
      });
    },
    [playerId]
  );

  return { emitMove, emitJump, emitChat, onlinePlayers };
}
