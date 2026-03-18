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
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [currentRoom, setCurrentRoom] = useState(-1);
  const [isMuted, setIsMuted] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  const currentRoomRef = useRef(currentRoom);
  currentRoomRef.current = currentRoom;

  const detectedRoom = enabled ? detectRoom(gridX, gridY) : -1;

  const updateParticipantCount = useCallback(() => {
    if (!callRef.current) {
      setParticipantCount(0);
      return;
    }
    const participants = callRef.current.participants();
    setParticipantCount(Object.keys(participants).length);
  }, []);

  // Reproduz audio de um participante remoto via <audio> element
  const playRemoteAudio = useCallback((participant: DailyParticipant) => {
    if (participant.local) return;
    const sessionId = participant.session_id;

    const audioTrack = participant.tracks?.audio;
    if (audioTrack?.state === "playable" && audioTrack.persistentTrack) {
      // Ja tem element? Atualiza a track
      let el = audioElementsRef.current.get(sessionId);
      if (!el) {
        el = document.createElement("audio");
        el.autoplay = true;
        (el as unknown as Record<string, boolean>).playsInline = true;
        audioElementsRef.current.set(sessionId, el);
      }
      const stream = new MediaStream([audioTrack.persistentTrack]);
      el.srcObject = stream;
      el.play().catch(() => {
        // Autoplay bloqueado — tenta novamente em interacao do usuario
      });
    }
  }, []);

  // Remove audio element de um participante
  const removeRemoteAudio = useCallback((sessionId: string) => {
    const el = audioElementsRef.current.get(sessionId);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioElementsRef.current.delete(sessionId);
    }
  }, []);

  // Limpa todos os audio elements
  const cleanupAudioElements = useCallback(() => {
    audioElementsRef.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audioElementsRef.current.clear();
  }, []);

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
    cleanupAudioElements();
    setIsInCall(false);
    setParticipantCount(0);
    setCurrentRoom(-1);
  }, [cleanupAudioElements]);

  const joinCall = useCallback(
    async (roomIndex: number) => {
      if (!playerName || isJoining) return;

      setIsJoining(true);

      try {
        if (callRef.current) {
          await leaveCall();
        }

        const data = await api.get<VoiceJoinResponse>(
          `/voice/join?roomIndex=${roomIndex}&userName=${encodeURIComponent(playerName)}`
        );

        const call = DailyIframe.createCallObject({
          audioSource: true,
          videoSource: false,
          subscribeToTracksAutomatically: true,
        });

        call.on("joined-meeting", () => {
          setIsInCall(true);
          setCurrentRoom(roomIndex);
          updateParticipantCount();

          // Reproduz audio de participantes que ja estao na call
          const participants = call.participants();
          Object.values(participants).forEach((p) => {
            if (!p.local) playRemoteAudio(p);
          });
        });

        call.on("left-meeting", () => {
          setIsInCall(false);
          setParticipantCount(0);
          cleanupAudioElements();
        });

        call.on("participant-joined", (event) => {
          updateParticipantCount();
          if (event?.participant) {
            playRemoteAudio(event.participant);
          }
        });

        call.on("participant-updated", (event) => {
          updateParticipantCount();
          if (event?.participant) {
            playRemoteAudio(event.participant);
          }
        });

        call.on("participant-left", (event) => {
          updateParticipantCount();
          if (event?.participant) {
            removeRemoteAudio(event.participant.session_id);
          }
        });

        call.on("error", () => {
          setIsInCall(false);
          cleanupAudioElements();
        });

        callRef.current = call;

        await call.join({ url: data.url, token: data.token });
      } catch (err) {
        console.error("Failed to join voice room:", err);
      } finally {
        setIsJoining(false);
      }
    },
    [playerName, isJoining, leaveCall, updateParticipantCount, playRemoteAudio, removeRemoteAudio, cleanupAudioElements]
  );

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
      leaveCall();
    } else {
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
      cleanupAudioElements();
    };
  }, [cleanupAudioElements]);

  return {
    isInCall,
    isJoining,
    isMuted,
    currentRoom,
    participantCount,
    toggleMute,
    leaveCall,
    roomLabel: currentRoom >= 0 ? ROOMS[currentRoom].label : null,
  };
}
