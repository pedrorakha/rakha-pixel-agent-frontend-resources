"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import DailyIframe, { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import { ROOMS } from "@/lib/constants";
import { api } from "@/lib/api";

// Som de notificacao via Web Audio API (sem arquivo externo)
function playJoinSound() {
  try {
    const audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // Beep duplo estilo pixel
    osc.type = "square";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.2);

    // Limpa contexto apos terminar
    setTimeout(() => audioCtx.close(), 300);
  } catch {
    // Ignora se AudioContext nao disponivel
  }
}

interface VoiceJoinResponse {
  url: string;
  token: string;
  roomName: string;
}

/**
 * Detecta em qual room (0-8) o jogador esta baseado na posicao grid.
 * Retorna -1 se nao esta em nenhuma room.
 */
export function detectRoom(gridX: number, gridY: number): number {
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
  playersInSameRoom: number; // quantos jogadores online estao no mesmo quarto (incluindo eu)
}

export function useVoiceChat({ playerName, gridX, gridY, enabled, playersInSameRoom }: UseVoiceChatOptions) {
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

  // So deve estar em call se tem 2+ jogadores no mesmo quarto
  const shouldBeInCall = detectedRoom >= 0 && playersInSameRoom >= 2;

  const updateParticipantCount = useCallback(() => {
    if (!callRef.current) {
      setParticipantCount(0);
      return;
    }
    const participants = callRef.current.participants();
    setParticipantCount(Object.keys(participants).length);
  }, []);

  const playRemoteAudio = useCallback((participant: DailyParticipant) => {
    if (participant.local) return;
    const sessionId = participant.session_id;

    const audioTrack = participant.tracks?.audio;
    if (audioTrack?.state === "playable" && audioTrack.persistentTrack) {
      let el = audioElementsRef.current.get(sessionId);
      if (!el) {
        el = document.createElement("audio");
        el.autoplay = true;
        (el as unknown as Record<string, boolean>).playsInline = true;
        audioElementsRef.current.set(sessionId, el);
      }
      const stream = new MediaStream([audioTrack.persistentTrack]);
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, []);

  const removeRemoteAudio = useCallback((sessionId: string) => {
    const el = audioElementsRef.current.get(sessionId);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioElementsRef.current.delete(sessionId);
    }
  }, []);

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

          const participants = call.participants();
          const remotes = Object.values(participants).filter((p) => !p.local);
          remotes.forEach((p) => playRemoteAudio(p));
          // Som ao entrar na call (se ja tem outros participantes)
          if (remotes.length > 0) playJoinSound();
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
            playJoinSound();
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

  // Auto join/leave baseado em room E quantidade de jogadores
  useEffect(() => {
    if (shouldBeInCall && !isInCall && !isJoining) {
      joinCall(detectedRoom);
    } else if (!shouldBeInCall && isInCall) {
      leaveCall();
    } else if (isInCall && detectedRoom !== currentRoomRef.current && detectedRoom >= 0) {
      // Mudou de room — reconecta
      joinCall(detectedRoom);
    }
  }, [shouldBeInCall, detectedRoom, isInCall, isJoining, joinCall, leaveCall]);

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
    detectedRoom,
    participantCount,
    toggleMute,
    leaveCall,
    roomLabel: currentRoom >= 0 ? ROOMS[currentRoom].label : null,
  };
}
