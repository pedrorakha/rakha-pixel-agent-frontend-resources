"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import DailyIframe, { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import { ROOMS } from "@/lib/constants";
import { api } from "@/lib/api";

interface VoiceJoinResponse {
  url: string;
  token: string;
  roomName: string;
}

/**
 * Detecta em qual room (0-8) o jogador esta baseado na posicao grid.
 * Retorna -1 se nao esta em nenhuma room.
 */
function detectRoom(gridX: number, gridY: number): number {
  for (let i = 0; i < ROOMS.length; i++) {
    const r = ROOMS[i];
    if (gridX >= r.x && gridX < r.x + r.w && gridY >= r.y && gridY < r.y + r.h) {
      return i;
    }
  }
  return -1;
}

interface UseVoiceChatOptions {
  playerName: string | null;
  gridX: number;
  gridY: number;
  enabled: boolean;
}

export function useVoiceChat({ playerName, gridX, gridY, enabled }: UseVoiceChatOptions) {
  const callRef = useRef<DailyCall | null>(null);
  const [currentRoom, setCurrentRoom] = useState(-1);
  const [isMuted, setIsMuted] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());

  const currentRoomRef = useRef(currentRoom);
  currentRoomRef.current = currentRoom;

  // Detecta mudanca de room
  const detectedRoom = enabled ? detectRoom(gridX, gridY) : -1;

  // Atualiza contagem de participantes
  const updateParticipantCount = useCallback(() => {
    if (!callRef.current) {
      setParticipantCount(0);
      return;
    }
    const participants = callRef.current.participants();
    setParticipantCount(Object.keys(participants).length);
  }, []);

  // Sai da call atual
  const leaveCall = useCallback(async () => {
    if (callRef.current) {
      try {
        await callRef.current.leave();
        callRef.current.destroy();
      } catch {
        // Ignora erro ao sair
      }
      callRef.current = null;
    }
    setIsInCall(false);
    setParticipantCount(0);
    setSpeakingIds(new Set());
    setCurrentRoom(-1);
  }, []);

  // Entra na call de uma room
  const joinCall = useCallback(
    async (roomIndex: number) => {
      if (!playerName || isJoining) return;

      setIsJoining(true);

      try {
        // Sai da call anterior se tiver
        if (callRef.current) {
          await leaveCall();
        }

        // Busca token do backend
        const data = await api.get<VoiceJoinResponse>(
          `/voice/join?roomIndex=${roomIndex}&userName=${encodeURIComponent(playerName)}`
        );

        // Cria instancia Daily
        const call = DailyIframe.createCallObject({
          audioSource: true,
          videoSource: false,
        });

        // Listeners
        call.on("joined-meeting", () => {
          setIsInCall(true);
          setCurrentRoom(roomIndex);
          updateParticipantCount();
        });

        call.on("left-meeting", () => {
          setIsInCall(false);
          setParticipantCount(0);
          setSpeakingIds(new Set());
        });

        call.on("participant-joined", () => updateParticipantCount());
        call.on("participant-left", () => updateParticipantCount());
        call.on("participant-updated", (event) => {
          updateParticipantCount();
          if (event?.participant) {
            const p = event.participant as DailyParticipant;
            const name = p.user_name || "";
            setSpeakingIds((prev) => {
              // Daily nao tem "is_speaking" direto, mas podemos checar tracks
              // Por enquanto, mostra todos que estao com audio ativo
              if (p.tracks?.audio?.state === "playable" && !p.local) {
                if (prev.has(name)) return prev;
                const next = new Set(prev);
                next.add(name);
                return next;
              }
              if (prev.has(name)) {
                const next = new Set(prev);
                next.delete(name);
                return next;
              }
              return prev;
            });
          }
        });

        call.on("error", () => {
          setIsInCall(false);
        });

        callRef.current = call;

        // Entra na call
        await call.join({ url: data.url, token: data.token });
      } catch (err) {
        console.error("Failed to join voice room:", err);
      } finally {
        setIsJoining(false);
      }
    },
    [playerName, isJoining, leaveCall, updateParticipantCount]
  );

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const newMuted = !isMuted;
    callRef.current.setLocalAudio(!newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  // Auto join/leave quando muda de room
  useEffect(() => {
    if (detectedRoom === currentRoomRef.current) return;

    if (detectedRoom === -1) {
      // Saiu de todas as rooms
      leaveCall();
    } else {
      // Entrou em uma room
      joinCall(detectedRoom);
    }
  }, [detectedRoom, joinCall, leaveCall]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (callRef.current) {
        callRef.current.leave().catch(() => {});
        callRef.current.destroy();
        callRef.current = null;
      }
    };
  }, []);

  return {
    isInCall,
    isJoining,
    isMuted,
    currentRoom,
    participantCount,
    speakingIds,
    toggleMute,
    leaveCall,
    roomLabel: currentRoom >= 0 ? ROOMS[currentRoom].label : null,
  };
}
