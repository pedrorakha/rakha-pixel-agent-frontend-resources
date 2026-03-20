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

    osc.type = "square";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.2);

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
 * Detecta em qual room (0-9) o jogador esta baseado na posicao grid.
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

export interface VoiceParticipant {
  sessionId: string;
  userName: string;
  isSpeaking: boolean;
  isLocal: boolean;
  isMutedByMe: boolean; // mutado localmente por mim
}

interface UseVoiceChatOptions {
  playerName: string | null;
  gridX: number;
  gridY: number;
  enabled: boolean;
  playersInSameRoom: number;
}

function loadPersistedBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v === null ? fallback : v === "true";
}

export function useVoiceChat({ playerName, gridX, gridY, enabled, playersInSameRoom }: UseVoiceChatOptions) {
  const callRef = useRef<DailyCall | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [currentRoom, setCurrentRoom] = useState(-1);
  const [isMuted, setIsMuted] = useState(() => loadPersistedBool("pxa:mic-muted", false));
  const isMutedRef = useRef(loadPersistedBool("pxa:mic-muted", false));
  const [isSoundOff, setIsSoundOff] = useState(() => loadPersistedBool("pxa:sound-off", false));
  const isSoundOffRef = useRef(loadPersistedBool("pxa:sound-off", false));
  const [isInCall, setIsInCall] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const mutedByMeRef = useRef<Set<string>>(new Set());

  const currentRoomRef = useRef(currentRoom);
  currentRoomRef.current = currentRoom;

  const detectedRoom = enabled ? detectRoom(gridX, gridY) : -1;
  const shouldBeInCall = detectedRoom >= 0 && playersInSameRoom >= 2;

  const updateParticipants = useCallback(() => {
    if (!callRef.current) {
      setParticipants([]);
      return;
    }
    const allParticipants = callRef.current.participants();
    const list: VoiceParticipant[] = Object.values(allParticipants).map((p: DailyParticipant) => ({
      sessionId: p.session_id,
      userName: p.user_name || "Unknown",
      isSpeaking: !!(p.tracks?.audio?.state === "playable" && !p.local),
      isLocal: !!p.local,
      isMutedByMe: mutedByMeRef.current.has(p.session_id),
    }));
    setParticipants(list);
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
      // Aplica mute local se estava mutado ou sound off
      el.volume = (isSoundOffRef.current || mutedByMeRef.current.has(sessionId)) ? 0 : 1;
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
    setParticipants([]);
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
          updateParticipants();

          if (isMutedRef.current) {
            call.setLocalAudio(false);
          }

          const allP = call.participants();
          const remotes = Object.values(allP).filter((p) => !p.local);
          remotes.forEach((p) => playRemoteAudio(p));
          if (remotes.length > 0) playJoinSound();
        });

        call.on("left-meeting", () => {
          setIsInCall(false);
          setParticipants([]);
          cleanupAudioElements();
        });

        call.on("participant-joined", (event) => {
          updateParticipants();
          if (event?.participant) {
            playRemoteAudio(event.participant);
            playJoinSound();
          }
        });

        call.on("participant-updated", (event) => {
          updateParticipants();
          if (event?.participant) {
            playRemoteAudio(event.participant);
          }
        });

        call.on("participant-left", (event) => {
          if (event?.participant) {
            removeRemoteAudio(event.participant.session_id);
            mutedByMeRef.current.delete(event.participant.session_id);
          }
          updateParticipants();
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
    [playerName, isJoining, leaveCall, updateParticipants, playRemoteAudio, removeRemoteAudio, cleanupAudioElements]
  );

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);
    localStorage.setItem("pxa:mic-muted", String(newMuted));
    if (callRef.current) {
      callRef.current.setLocalAudio(!newMuted);
    }
  }, [isMuted]);

  // Aplica volume em todos os audio elements remotos
  const applyVolumeToAll = useCallback((soundOff: boolean) => {
    audioElementsRef.current.forEach((el, sid) => {
      el.volume = (soundOff || mutedByMeRef.current.has(sid)) ? 0 : 1;
    });
  }, []);

  const toggleSound = useCallback(() => {
    const newSoundOff = !isSoundOff;
    isSoundOffRef.current = newSoundOff;
    setIsSoundOff(newSoundOff);
    localStorage.setItem("pxa:sound-off", String(newSoundOff));
    applyVolumeToAll(newSoundOff);
    // Mutar som também muta o mic
    if (newSoundOff && !isMuted) {
      isMutedRef.current = true;
      setIsMuted(true);
      localStorage.setItem("pxa:mic-muted", "true");
      if (callRef.current) {
        callRef.current.setLocalAudio(false);
      }
    }
  }, [isSoundOff, isMuted, applyVolumeToAll]);

  // Mutar/desmutar um participante remoto localmente
  const toggleMuteParticipant = useCallback((sessionId: string) => {
    const wasMuted = mutedByMeRef.current.has(sessionId);
    if (wasMuted) {
      mutedByMeRef.current.delete(sessionId);
    } else {
      mutedByMeRef.current.add(sessionId);
    }
    // Ajusta volume do audio element (respeita sound off global)
    const el = audioElementsRef.current.get(sessionId);
    if (el) {
      el.volume = (isSoundOffRef.current || !wasMuted) ? 0 : 1;
    }
    updateParticipants();
  }, [updateParticipants]);

  // Auto join/leave baseado em room E quantidade de jogadores
  useEffect(() => {
    if (shouldBeInCall && !isInCall && !isJoining) {
      joinCall(detectedRoom);
    } else if (!shouldBeInCall && isInCall) {
      leaveCall();
    } else if (isInCall && detectedRoom !== currentRoomRef.current && detectedRoom >= 0) {
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
    isSoundOff,
    currentRoom,
    detectedRoom,
    participantCount: participants.length,
    participants,
    toggleMute,
    toggleSound,
    toggleMuteParticipant,
    leaveCall,
    roomLabel: currentRoom >= 0 ? ROOMS[currentRoom].label : null,
  };
}
