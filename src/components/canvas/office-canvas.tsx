"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCanvas } from "@/hooks/use-canvas";
import { useGameLoop } from "@/hooks/use-game-loop";
import { useOfficeStore } from "@/stores/office-store";
import { useDiscordStore } from "@/stores/discord-store";
import { usePlayerStore } from "@/stores/player-store";
import { useChatStore } from "@/stores/chat-store";
import { useReactionStore } from "@/stores/reaction-store";
import { useFootprintStore } from "@/stores/footprint-store";
import { usePlayerMovement } from "@/hooks/use-player-movement";
import { useVoiceChat, detectRoom } from "@/hooks/use-voice-chat";
import {
  useMultiplayerSync,
  PlayerMovePayload,
  PlayerJumpPayload,
  PlayerLeavePayload,
  ChatMessagePayload,
  PlayerReactionPayload,
  PlayerVisualPayload,
  DoorStatusPayload,
  PlayerInteractPayload,
} from "@/hooks/use-multiplayer-sync";
import { Renderer, updateCharacterAnimations } from "@/engine/renderer";
import { Tilemap } from "@/engine/tilemap";
import { GameState } from "@/engine/types";
import { Character, STATUS_TO_STATE } from "@/types/character";
import { DiscordStatus } from "@/types/discord";
import { Desk } from "@/types/office";
import { api } from "@/lib/api";
import {
  TILE_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
  STATUS_TO_CHARACTER_STATE,
  COFFEE_AREA,
  BED_AREA,
  ROOM_FURNITURE,
  ROOMS,
  MEETING_ROOM_INDEX,
  ROOM_DOORS,
  DOG_POSITION,
  GARDEN,
  STATIC_BLOCKED_TILES,
} from "@/lib/constants";

interface ApiMember {
  id: string;
  name: string;
  discord_id: string;
  character_sprite: string;
  desk_id: string | null;
  current_status: string;
  current_animation: string;
  is_active: boolean;
  accessory_hat: string;
  accessory_glasses: string;
  hair_style: string;
  color_shirt: string;
  color_hair: string;
  color_skin: string;
  created_at: string;
  updated_at: string;
}

interface ApiDesk {
  id: string;
  label: string;
  grid_x: number;
  grid_y: number;
  direction: string;
  created_at: string;
  updated_at: string;
}

const SPRITE_COLOR_MAP: Record<string, string> = {
  char_01: "#3498db",
  char_02: "#e74c3c",
  char_03: "#2ecc71",
  char_04: "#9b59b6",
  char_05: "#f39c12",
  char_06: "#1abc9c",
};

const API_DIRECTION_MAP: Record<string, "up" | "down" | "left" | "right"> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
  north: "up",
  south: "down",
  east: "right",
  west: "left",
};

// Constantes do pulo
const JUMP_VELOCITY = 18;
const JUMP_GRAVITY = 80;

// Sons de interacao via Web Audio
function playPokeSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.05);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 200);
  } catch { /* ignore */ }
}

function playHugSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(550, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 400);
  } catch { /* ignore */ }
}

function playHighFiveSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.setValueAtTime(900, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
    setTimeout(() => ctx.close(), 150);
  } catch { /* ignore */ }
}

const INTERACT_ACTIONS = [
  { id: "poke", label: "👆 POKE", emoji: "👆" },
  { id: "hug", label: "🤗 HUG", emoji: "🤗" },
  { id: "high_five", label: "🖐️ HIGH FIVE", emoji: "🖐️" },
  { id: "wave_at", label: "👋 WAVE", emoji: "👋" },
] as const;

const INTERACT_SOUNDS: Record<string, () => void> = {
  poke: playPokeSound,
  hug: playHugSound,
  high_five: playHighFiveSound,
};

interface OfficeCanvasProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenVisualEditor: () => void;
}

export function OfficeCanvas({ sidebarOpen, onToggleSidebar, onOpenVisualEditor }: OfficeCanvasProps) {
  const { canvasRef, ctx, size } = useCanvas();
  const {
    layout,
    desks: storeDesks,
    zoom,
    cameraX,
    cameraY,
    startPan,
    endPan,
    updatePan,
    zoomIn,
    zoomOut,
    setDesks,
  } = useOfficeStore();
  const presences = useDiscordStore((s) => s.presences);
  const selectedMemberId = usePlayerStore((s) => s.selectedMemberId);
  const selectedMemberName = usePlayerStore((s) => s.selectedMemberName);
  const chatBubbles = useChatStore((s) => s.bubbles);
  const chatHistory = useChatStore((s) => s.history);
  const addBubble = useChatStore((s) => s.addBubble);
  const updateBubbles = useChatStore((s) => s.updateBubbles);
  const floatingReactions = useReactionStore((s) => s.reactions);
  const addReaction = useReactionStore((s) => s.addReaction);
  const updateReactions = useReactionStore((s) => s.updateReactions);
  const footprints = useFootprintStore((s) => s.footprints);
  const addFootprint = useFootprintStore((s) => s.addFootprint);
  const updateFootprints = useFootprintStore((s) => s.updateFootprints);
  const isSpectator = usePlayerStore((s) => s.isSpectator);
  const clearSelectedMember = usePlayerStore((s) => s.clearSelectedMember);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [presenceMap, setPresenceMap] = useState<Map<string, DiscordStatus>>(new Map());
  const [chatInput, setChatInput] = useState("");
  const [chatFocused, setChatFocused] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [charMenu, setCharMenu] = useState<{ screenX: number; screenY: number } | null>(null);
  const [interactMenu, setInteractMenu] = useState<{ screenX: number; screenY: number; targetId: string; targetName: string } | null>(null);
  const [lockedDoors, setLockedDoors] = useState<Set<number>>(new Set());
  const dogPetFrameRef = useRef(-1);

  // Estado dinâmico do cachorro (anda pelo garden, senta, repete)
  const dogRef = useRef({
    x: DOG_POSITION.x,
    y: DOG_POSITION.y,
    state: "sitting" as "walking" | "sitting",
    direction: "right" as "left" | "right" | "up" | "down",
    timer: 0,
    walkDuration: 3,   // segundos andando
    sitDuration: 4,    // segundos sentado
    moveTimer: 0,
    moveInterval: 0.4, // segundos entre cada tile ao andar
    targetX: DOG_POSITION.x,
    targetY: DOG_POSITION.y,
  });

  const chatInputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const tilemapRef = useRef<Tilemap | null>(null);
  const charactersRef = useRef<Character[]>(characters);

  // Auto-scroll historico quando nova mensagem chega
  useEffect(() => {
    if (historyOpen) {
      historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory.length, historyOpen]);

  // Refs para evitar stale closures no game loop
  const selectedMemberIdRef = useRef(selectedMemberId);
  selectedMemberIdRef.current = selectedMemberId;

  const chatFocusedRef = useRef(chatFocused);
  chatFocusedRef.current = chatFocused;

  const lockedDoorsRef = useRef(lockedDoors);
  lockedDoorsRef.current = lockedDoors;

  const refetchDataRef = useRef<() => void>(() => {});

  // Track jump velocity per character
  const jumpVelocitiesRef = useRef<Map<string, number>>(new Map());

  // Track se o mouse moveu durante o drag
  const mouseDraggedRef = useRef(false);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  // Keep ref in sync
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  // --- Multiplayer callbacks ---

  // Buffer de posicoes pendentes (recebidas antes dos characters carregarem)
  const pendingSyncRef = useRef<PlayerMovePayload[]>([]);

  const handleRemoteMove = useCallback(
    (payload: PlayerMovePayload) => {
      setCharacters((prev) => {
        // Se characters ainda nao carregou, guarda no buffer
        if (prev.length === 0) {
          pendingSyncRef.current.push(payload);
          return prev;
        }
        return prev.map((char) => {
          if (char.id !== payload.memberId) return char;
          return {
            ...char,
            gridX: payload.gridX,
            gridY: payload.gridY,
            direction: payload.direction,
            state: payload.state,
            animationFrame: 0,
            animationTimer: 0,
          };
        });
      });
    },
    []
  );

  const handleRemoteJump = useCallback(
    (payload: PlayerJumpPayload) => {
      jumpVelocitiesRef.current.set(payload.memberId, JUMP_VELOCITY);
    },
    []
  );

  const handleChatMessage = useCallback(
    (payload: ChatMessagePayload) => {
      addBubble({
        id: payload.id,
        memberId: payload.memberId,
        memberName: payload.memberName,
        message: payload.message,
        timestamp: payload.timestamp,
      });
    },
    [addBubble]
  );

  const handleReaction = useCallback(
    (payload: PlayerReactionPayload) => {
      addReaction(payload.memberId, payload.emoji, payload.timestamp);
    },
    [addReaction]
  );

  const handleVisualUpdate = useCallback(
    (payload: PlayerVisualPayload) => {
      setCharacters((prev) =>
        prev.map((char) => {
          if (char.id !== payload.memberId) return char;
          return {
            ...char,
            hat: payload.hat as Character["hat"],
            glasses: payload.glasses as Character["glasses"],
            hairStyle: payload.hairStyle as Character["hairStyle"],
            colorShirt: payload.colorShirt,
            colorHair: payload.colorHair,
            colorSkin: payload.colorSkin,
          };
        })
      );
    },
    []
  );

  // Jogador saiu — retorna personagem a posicao baseada no Discord status
  const presenceMapRef = useRef(presenceMap);
  presenceMapRef.current = presenceMap;

  const handlePlayerLeave = useCallback(
    (payload: PlayerLeavePayload) => {
      setCharacters((prev) =>
        prev.map((char) => {
          if (char.id !== payload.memberId) return char;

          // Busca status real: primeiro do Discord WebSocket, depois do mapa da API
          const wsPresence = presences.get(char.discordId);
          const apiStatus = presenceMapRef.current.get(char.discordId);
          const status = wsPresence?.status ?? apiStatus ?? "offline";
          const newState = STATUS_TO_STATE[status];

          let newX = char.gridX;
          let newY = char.gridY;
          let newDir = char.direction;

          if (char.deskId) {
            const desk = storeDesks.find((d) => d.id === char.deskId);
            let roomIndex = -1;
            if (desk) {
              for (let ri = 0; ri < ROOMS.length; ri++) {
                const room = ROOMS[ri];
                if (desk.gridX >= room.x && desk.gridX < room.x + room.w &&
                    desk.gridY >= room.y && desk.gridY < room.y + room.h) {
                  roomIndex = ri;
                  break;
                }
              }
            }
            const roomFurn = roomIndex >= 0 ? ROOM_FURNITURE[roomIndex] : null;

            if (status === "offline" && roomFurn) {
              newX = roomFurn.bed.x + 1;
              newY = roomFurn.bed.y;
              newDir = "right";
            } else if (status === "idle" && roomFurn) {
              newX = roomFurn.coffee.x;
              newY = roomFurn.coffee.y + 1;
              newDir = "right";
            } else if (desk) {
              newX = desk.gridX;
              newY = desk.gridY + 1;
              newDir = "down";
            }
          }

          return {
            ...char,
            state: newState,
            gridX: newX,
            gridY: newY,
            direction: newDir,
            animationFrame: 0,
            animationTimer: 0,
            jumpOffset: 0,
          };
        })
      );
    },
    [presences, storeDesks]
  );

  const getPlayerPosition = useCallback(() => {
    const char = charactersRef.current.find((c) => c.id === selectedMemberIdRef.current);
    if (!char) return null;
    return { gridX: char.gridX, gridY: char.gridY, direction: char.direction, state: char.state };
  }, []);

  const handleRemoteJoin = useCallback((memberId: string) => {
    // Se o membro que entrou nao esta na nossa lista, refetch
    const known = charactersRef.current.some((c) => c.id === memberId);
    if (!known) {
      refetchDataRef.current();
    }
  }, []);

  const handleDoorStatus = useCallback((payload: DoorStatusPayload) => {
    setLockedDoors(new Set(payload.lockedRooms));
  }, []);

  const handleInteract = useCallback((payload: PlayerInteractPayload) => {
    const action = INTERACT_ACTIONS.find((a) => a.id === payload.action);
    if (!action) return;

    // Toca som
    INTERACT_SOUNDS[payload.action]?.();

    // Mostra emoji flutuante no personagem alvo
    addReaction(payload.toId, action.emoji, payload.timestamp);

    // Se eu fui o alvo, mostra tambem no remetente
    if (payload.toId === selectedMemberIdRef.current) {
      addReaction(payload.fromId, action.emoji, payload.timestamp);
    }
  }, [addReaction]);

  const { emitMove, emitJump, emitChat, emitReaction, emitVisual, emitDoorToggle, emitInteract, onlinePlayers } = useMultiplayerSync({
    playerId: selectedMemberId,
    getPlayerPosition,
    onRemoteMove: handleRemoteMove,
    onRemoteJump: handleRemoteJump,
    onChatMessage: handleChatMessage,
    onPlayerLeave: handlePlayerLeave,
    onReaction: handleReaction,
    onVisualUpdate: handleVisualUpdate,
    onRemoteJoin: handleRemoteJoin,
    onDoorStatus: handleDoorStatus,
    onInteract: handleInteract,
  });

  // Registra emitVisual no store para uso externo (VisualEditor)
  const setEmitVisualFn = usePlayerStore((s) => s.setEmitVisualFn);
  useEffect(() => {
    setEmitVisualFn(emitVisual);
  }, [emitVisual, setEmitVisualFn]);

  // Voice chat — so conecta quando 2+ jogadores no mesmo quarto
  const currentPlayerChar = characters.find((c) => c.id === selectedMemberId);
  const myRoom = currentPlayerChar ? detectRoom(currentPlayerChar.gridX, currentPlayerChar.gridY) : -1;
  // Detecta se jogador esta perto de alguma porta (dentro de qualquer room)
  const nearDoorRoomIndex = currentPlayerChar
    ? ROOM_DOORS.findIndex((door) =>
        door.insideTrigger.some(
          (t) => t.x === currentPlayerChar.gridX && t.y === currentPlayerChar.gridY
        )
      )
    : -1;
  const isNearAnyDoor = nearDoorRoomIndex >= 0;
  const isNearRoomLocked = isNearAnyDoor && lockedDoors.has(nearDoorRoomIndex);
  const isNearDog = currentPlayerChar
    ? Math.abs(currentPlayerChar.gridX - dogRef.current.x) <= 1 &&
      Math.abs(currentPlayerChar.gridY - dogRef.current.y) <= 1 &&
      !(currentPlayerChar.gridX === dogRef.current.x && currentPlayerChar.gridY === dogRef.current.y)
    : false;
  const playersInSameRoom = myRoom >= 0
    ? characters.filter((c) => {
        if (c.id === selectedMemberId) return true; // eu
        if (!onlinePlayers.has(c.id)) return false; // nao esta online
        return detectRoom(c.gridX, c.gridY) === myRoom;
      }).length
    : 0;

  const {
    isInCall,
    isJoining: voiceJoining,
    isMuted,
    isSoundOff,
    participantCount,
    participants: voiceParticipants,
    roomLabel: voiceRoomLabel,
    toggleMute,
    toggleSound,
    toggleMuteParticipant,
  } = useVoiceChat({
    playerName: selectedMemberName,
    gridX: currentPlayerChar?.gridX ?? -1,
    gridY: currentPlayerChar?.gridY ?? -1,
    enabled: !!selectedMemberId,
    playersInSameRoom,
  });

  // Callback quando o jogador local se move
  const handlePlayerMove = useCallback(
    (gridX: number, gridY: number, direction: Character["direction"]) => {
      // Mover fecha menu — walking_coffee persiste, outros viram walking
      setCharMenu(null);
      addFootprint(gridX, gridY);
      setCharacters((prev) =>
        prev.map((char) => {
          if (char.id !== selectedMemberIdRef.current) return char;
          const moveState = char.state === "walking_coffee" ? "walking_coffee" as const : "walking" as const;
          return {
            ...char,
            gridX,
            gridY,
            direction,
            state: moveState,
            animationFrame: 0,
            animationTimer: 0,
          };
        })
      );
      const currentChar = charactersRef.current.find((c) => c.id === selectedMemberIdRef.current);
      const moveState = currentChar?.state === "walking_coffee" ? "walking_coffee" : "walking";
      emitMove(gridX, gridY, direction, moveState);
    },
    [emitMove]
  );

  // Toggle danca
  // Emotes: lista de estados que o jogador pode ativar
  type EmoteState = "dancing" | "walking_coffee" | "waving" | "sitting_floor";
  const EMOTE_LABELS: Record<EmoteState, string> = {
    dancing: "DANCE",
    walking_coffee: "COFFEE",
    waving: "WAVE",
    sitting_floor: "SIT",
  };

  const handleEmote = useCallback((emote: EmoteState) => {
    const playerChar = charactersRef.current.find(
      (c) => c.id === selectedMemberIdRef.current
    );
    if (!playerChar) return;

    // Se ja esta no emote, desativa (volta pra idle)
    const newState = playerChar.state === emote ? "idle" as const : emote;

    setCharacters((prev) =>
      prev.map((char) => {
        if (char.id !== selectedMemberIdRef.current) return char;
        return { ...char, state: newState, animationFrame: 0, animationTimer: 0 };
      })
    );
    emitMove(playerChar.gridX, playerChar.gridY, playerChar.direction, newState);
    setCharMenu(null);
  }, [emitMove]);

  // Hook de movimentacao do jogador
  const { updateMovement, handleClickMove, hasActiveInput } = usePlayerMovement({
    playerId: selectedMemberId,
    tilemap: tilemapRef.current,
    desks: storeDesks,
    characters,
    onMove: handlePlayerMove,
    lockedDoors,
  });

  // --- Space bar jump + Enter chat ---
  useEffect(() => {
    if (!selectedMemberId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se um elemento interativo esta focado
      const tag = (e.target as HTMLElement)?.tagName;
      const isInputFocused = tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON";

      if (e.code === "Space" && !isInputFocused) {
        e.preventDefault();
        const char = charactersRef.current.find(
          (c) => c.id === selectedMemberIdRef.current
        );
        if (!char) return;

        // Verifica se esta adjacente a alguma porta (dentro de qualquer room)
        const doorRoomIdx = ROOM_DOORS.findIndex((door) =>
          door.insideTrigger.some(
            (t) => t.x === char.gridX && t.y === char.gridY
          )
        );
        if (doorRoomIdx >= 0) {
          emitDoorToggle(doorRoomIdx);
          return;
        }

        // Verifica se esta adjacente ao cachorro (posicao dinamica)
        const dogNear = Math.abs(char.gridX - dogRef.current.x) <= 1 &&
          Math.abs(char.gridY - dogRef.current.y) <= 1 &&
          !(char.gridX === dogRef.current.x && char.gridY === dogRef.current.y);
        if (dogNear && dogPetFrameRef.current < 0) {
          dogPetFrameRef.current = 0;
          return;
        }

        // Pulo normal
        if (char.jumpOffset > 0) return;
        jumpVelocitiesRef.current.set(char.id, JUMP_VELOCITY);
        emitJump(char.gridX, char.gridY);
      }

      // Enter abre o chat (se nao esta no input)
      if (e.code === "Enter" && !isInputFocused) {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMemberId, emitJump, emitDoorToggle]);

  // --- Chat submit ---
  const handleChatSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || !selectedMemberId || !selectedMemberName) return;

      const char = charactersRef.current.find(
        (c) => c.id === selectedMemberId
      );
      if (!char) return;

      emitChat(selectedMemberName, chatInput.trim(), char.gridX, char.gridY);
      setChatInput("");
      chatInputRef.current?.blur();
    },
    [chatInput, selectedMemberId, selectedMemberName, emitChat]
  );

  // Fetch members and desks from API
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [apiMembers, apiDesks] = await Promise.all([
          api.get<ApiMember[]>("/members"),
          api.get<ApiDesk[]>("/office/desks"),
        ]);

        if (cancelled) return;

        const deskMap = new Map(
          (apiDesks ?? []).map((d) => [d.id, d])
        );

        const convertedDesks: Desk[] = (apiDesks ?? []).map((d) => ({
          id: d.id,
          gridX: d.grid_x,
          gridY: d.grid_y,
          direction: (API_DIRECTION_MAP[d.direction] === "up" ? "north" :
                      API_DIRECTION_MAP[d.direction] === "down" ? "south" :
                      API_DIRECTION_MAP[d.direction] === "right" ? "east" : "west") as "north" | "south" | "east" | "west",
          label: d.label,
          assignedMemberId: null,
        }));
        setDesks(convertedDesks);

        const newPresenceMap = new Map<string, DiscordStatus>();

        const deskToRoom = new Map<string, number>();
        deskMap.forEach((apiDesk, deskId) => {
          for (let ri = 0; ri < ROOMS.length; ri++) {
            const room = ROOMS[ri];
            if (apiDesk.grid_x >= room.x && apiDesk.grid_x < room.x + room.w &&
                apiDesk.grid_y >= room.y && apiDesk.grid_y < room.y + room.h) {
              deskToRoom.set(deskId, ri);
              break;
            }
          }
        });

        let coffeeIndex = 0;
        let bedIndex = 0;

        const chars: Character[] = (apiMembers ?? [])
          .filter((m) => m.is_active)
          .map((m) => {
            const status = (m.current_status as DiscordStatus) || "offline";
            const state = STATUS_TO_CHARACTER_STATE[status];
            const color = SPRITE_COLOR_MAP[m.character_sprite] ?? "#3498db";

            newPresenceMap.set(m.discord_id, status);

            let gridX: number;
            let gridY: number;
            let direction: "up" | "down" | "left" | "right" = "down";
            let deskId: string | null = null;

            if (m.desk_id && deskMap.has(m.desk_id)) {
              const desk = deskMap.get(m.desk_id)!;
              deskId = m.desk_id;
              const roomIndex = deskToRoom.get(m.desk_id);
              const roomFurn = roomIndex !== undefined ? ROOM_FURNITURE[roomIndex] : null;

              if (status === "offline" && roomFurn) {
                gridX = roomFurn.bed.x + 1;
                gridY = roomFurn.bed.y;
                direction = "right";
              } else if (status === "idle" && roomFurn) {
                gridX = roomFurn.coffee.x;
                gridY = roomFurn.coffee.y + 1;
                direction = "right";
              } else {
                const deskDir = API_DIRECTION_MAP[desk.direction] ?? "down";
                direction = deskDir;
                gridX = desk.grid_x;
                gridY = desk.grid_y + 1;
                if (deskDir === "up") { gridX = desk.grid_x; gridY = desk.grid_y - 1; }
                else if (deskDir === "left") { gridX = desk.grid_x - 1; gridY = desk.grid_y; }
                else if (deskDir === "right") { gridX = desk.grid_x + 2; gridY = desk.grid_y; }
              }
            } else if (status === "idle" || status === "dnd") {
              gridX = COFFEE_AREA.x + (coffeeIndex % COFFEE_AREA.width);
              gridY = COFFEE_AREA.y + Math.floor(coffeeIndex / COFFEE_AREA.width);
              coffeeIndex++;
              direction = "right";
            } else {
              gridX = BED_AREA.x + (bedIndex % BED_AREA.width);
              gridY = BED_AREA.y + Math.floor(bedIndex / BED_AREA.width);
              bedIndex++;
              direction = "right";
            }

            return {
              id: m.id,
              name: m.name,
              discordId: m.discord_id,
              spriteSheet: m.character_sprite,
              deskId,
              gridX,
              gridY,
              targetX: null,
              targetY: null,
              state,
              direction,
              color,
              animationFrame: 0,
              animationTimer: 0,
              hat: (m.accessory_hat || "none") as Character["hat"],
              glasses: (m.accessory_glasses || "none") as Character["glasses"],
              hairStyle: (m.hair_style || "short") as Character["hairStyle"],
              colorShirt: m.color_shirt || color,
              colorHair: m.color_hair || "#4a3728",
              colorSkin: m.color_skin || "#ffccaa",
              jumpOffset: 0,
              jumpTimer: 0,
            } satisfies Character;
          });

        // Aplica posicoes pendentes do sync (recebidas antes do fetch)
        const pending = pendingSyncRef.current;
        if (pending.length > 0) {
          const pendingMap = new Map<string, PlayerMovePayload>();
          for (const p of pending) pendingMap.set(p.memberId, p);
          for (let i = 0; i < chars.length; i++) {
            const update = pendingMap.get(chars[i].id);
            if (update) {
              chars[i] = {
                ...chars[i],
                gridX: update.gridX,
                gridY: update.gridY,
                direction: update.direction,
                state: update.state,
                animationFrame: 0,
                animationTimer: 0,
              };
            }
          }
          pendingSyncRef.current = [];
        }

        setCharacters(chars);
        setPresenceMap(newPresenceMap);
      } catch (err) {
        console.error("Failed to fetch office data:", err);
      }
    }

    fetchData();
    refetchDataRef.current = fetchData;
    return () => { cancelled = true; };
  }, [setDesks]);

  // Initialize tilemap and renderer
  useEffect(() => {
    const tilemap = new Tilemap(layout);
    tilemapRef.current = tilemap;
    const renderer = new Renderer(tilemap);
    rendererRef.current = renderer;
  }, [layout]);

  // Update renderer context
  useEffect(() => {
    if (ctx && rendererRef.current) {
      rendererRef.current.setContext(ctx);
    }
  }, [ctx]);

  // Update character states when discord presence changes (nao-controlados)
  useEffect(() => {
    if (presences.size === 0) return;

    setCharacters((prev) =>
      prev.map((char) => {
        if (char.id === selectedMemberIdRef.current) return char;

        const presence = presences.get(char.discordId);
        if (!presence) return char;
        const newState = STATUS_TO_STATE[presence.status];
        if (newState === char.state) return char;

        let newX = char.gridX;
        let newY = char.gridY;
        let newDir = char.direction;

        if (char.deskId) {
          const desk = storeDesks.find((d) => d.id === char.deskId);
          let roomIndex = -1;
          if (desk) {
            for (let ri = 0; ri < ROOMS.length; ri++) {
              const room = ROOMS[ri];
              if (desk.gridX >= room.x && desk.gridX < room.x + room.w &&
                  desk.gridY >= room.y && desk.gridY < room.y + room.h) {
                roomIndex = ri;
                break;
              }
            }
          }
          const roomFurn = roomIndex >= 0 ? ROOM_FURNITURE[roomIndex] : null;

          if (presence.status === "offline" && roomFurn) {
            newX = roomFurn.bed.x + 1;
            newY = roomFurn.bed.y;
            newDir = "right";
          } else if (presence.status === "idle" && roomFurn) {
            newX = roomFurn.coffee.x;
            newY = roomFurn.coffee.y + 1;
            newDir = "right";
          } else if (desk) {
            newX = desk.gridX;
            newY = desk.gridY + 1;
            newDir = "down";
          }
        }

        return {
          ...char,
          state: newState,
          gridX: newX,
          gridY: newY,
          direction: newDir,
          animationFrame: 0,
          animationTimer: 0,
        };
      })
    );

    setPresenceMap((prev) => {
      const updated = new Map(prev);
      presences.forEach((p, discordId) => {
        updated.set(discordId, p.status);
      });
      return updated;
    });
  }, [presences, storeDesks]);

  // Idle timer
  const idleTimerRef = useRef(0);
  const IDLE_DELAY = 0.3;

  const update = useCallback(
    (deltaTime: number) => {
      // Atualiza animacoes
      setCharacters((prev) => {
        let updated = updateCharacterAnimations(prev, deltaTime);

        // Atualiza pulo (fisica simples: parabola)
        const velocities = jumpVelocitiesRef.current;
        if (velocities.size > 0) {
          updated = updated.map((char) => {
            const vel = velocities.get(char.id);
            if (vel === undefined && char.jumpOffset <= 0) return char;

            const currentVel = vel ?? 0;
            const newVel = currentVel - JUMP_GRAVITY * deltaTime;
            const newOffset = Math.max(0, char.jumpOffset + newVel * deltaTime);

            if (newOffset <= 0 && newVel < 0) {
              // Aterrissou
              velocities.delete(char.id);
              return { ...char, jumpOffset: 0 };
            }

            velocities.set(char.id, newVel);
            return { ...char, jumpOffset: newOffset };
          });
        }

        return updated;
      });

      // Atualiza chat bubbles (fade)
      updateBubbles(deltaTime);
      updateReactions(deltaTime);
      updateFootprints();

      // Atualiza animacao do cachorro (pet)
      if (dogPetFrameRef.current >= 0) {
        dogPetFrameRef.current += 1;
        if (dogPetFrameRef.current >= 60) {
          dogPetFrameRef.current = -1;
        }
      }

      // Atualiza movimento do cachorro (anda pelo garden, senta, repete)
      const dog = dogRef.current;
      dog.timer += deltaTime;

      // Tiles bloqueadas do garden (arvores, cerca, etc)
      const isDogBlocked = (tx: number, ty: number) =>
        STATIC_BLOCKED_TILES.some((t) => t.x === tx && t.y === ty) ||
        tx < GARDEN.x || tx >= GARDEN.x + GARDEN.w ||
        ty < GARDEN.y || ty >= GARDEN.y + GARDEN.h;

      if (dog.state === "sitting") {
        if (dog.timer >= dog.sitDuration) {
          dog.state = "walking";
          dog.timer = 0;
          dog.walkDuration = 2 + Math.random() * 3;
          // Escolhe destino aleatorio valido dentro do garden
          for (let attempt = 0; attempt < 20; attempt++) {
            const tx = GARDEN.x + 1 + Math.floor(Math.random() * (GARDEN.w - 2));
            const ty = GARDEN.y + 2 + Math.floor(Math.random() * (GARDEN.h - 3));
            if (!isDogBlocked(tx, ty)) {
              dog.targetX = tx;
              dog.targetY = ty;
              break;
            }
          }
        }
      } else {
        dog.moveTimer += deltaTime;
        if (dog.moveTimer >= dog.moveInterval) {
          dog.moveTimer = 0;
          const ddx = dog.targetX - dog.x;
          const ddy = dog.targetY - dog.y;
          if (ddx === 0 && ddy === 0) {
            dog.state = "sitting";
            dog.timer = 0;
            dog.sitDuration = 3 + Math.random() * 4;
          } else {
            let nx = dog.x;
            let ny = dog.y;
            if (Math.abs(ddx) >= Math.abs(ddy)) {
              nx += ddx > 0 ? 1 : -1;
              dog.direction = ddx > 0 ? "right" : "left";
            } else {
              ny += ddy > 0 ? 1 : -1;
              dog.direction = ddy > 0 ? "down" : "up";
            }
            // So move se a proxima tile nao esta bloqueada
            if (!isDogBlocked(nx, ny)) {
              dog.x = nx;
              dog.y = ny;
            } else {
              // Bloqueado, senta e tenta outro destino no proximo ciclo
              dog.state = "sitting";
              dog.timer = 0;
              dog.sitDuration = 1 + Math.random() * 2;
            }
          }
        }
        if (dog.timer >= dog.walkDuration) {
          dog.state = "sitting";
          dog.timer = 0;
          dog.sitDuration = 3 + Math.random() * 4;
        }
      }

      // Movimentacao do jogador (ignora se chat focado)
      if (!chatFocusedRef.current) {
        const playerChar = charactersRef.current.find(
          (c) => c.id === selectedMemberIdRef.current
        );
        updateMovement(deltaTime, playerChar);

        // Idle revert
        if (playerChar && playerChar.state === "walking") {
          if (!hasActiveInput()) {
            idleTimerRef.current += deltaTime;
            if (idleTimerRef.current >= IDLE_DELAY) {
              idleTimerRef.current = 0;
              setCharacters((prev) =>
                prev.map((char) => {
                  if (char.id !== selectedMemberIdRef.current) return char;
                  return { ...char, state: "idle" as const, animationFrame: 0, animationTimer: 0 };
                })
              );
              if (playerChar) {
                emitMove(playerChar.gridX, playerChar.gridY, playerChar.direction, "idle");
              }
            }
          } else {
            idleTimerRef.current = 0;
          }
        }
      }
    },
    [updateMovement, hasActiveInput, emitMove, updateBubbles]
  );

  const chatBubblesRef = useRef(chatBubbles);
  chatBubblesRef.current = chatBubbles;

  const onlinePlayersRef = useRef(onlinePlayers);
  onlinePlayersRef.current = onlinePlayers;

  const reactionsRef = useRef(floatingReactions);
  reactionsRef.current = floatingReactions;

  const footprintsRef = useRef(footprints);
  footprintsRef.current = footprints;

  const render = useCallback(
    (_deltaTime: number, time: number) => {
      if (!ctx || !rendererRef.current) return;

      const gameState: GameState = {
        camera: { x: cameraX, y: cameraY, zoom },
        deltaTime: _deltaTime,
        time,
        canvasWidth: size.width,
        canvasHeight: size.height,
      };

      const mergedPresenceMap = new Map<string, DiscordStatus>(presenceMap);
      presences.forEach((p, discordId) => {
        mergedPresenceMap.set(discordId, p.status);
      });

      // Calcula se jogador esta perto de alguma porta (dentro de qualquer room)
      const localChar = charactersRef.current.find(
        (c) => c.id === selectedMemberIdRef.current
      );
      const nearDoorRoom = localChar
        ? ROOM_DOORS.findIndex((door) =>
            door.insideTrigger.some(
              (t) => t.x === localChar.gridX && t.y === localChar.gridY
            )
          )
        : -1;

      rendererRef.current.render(
        gameState,
        storeDesks,
        charactersRef.current,
        mergedPresenceMap,
        selectedMemberIdRef.current,
        chatBubblesRef.current,
        onlinePlayersRef.current,
        reactionsRef.current,
        footprintsRef.current,
        lockedDoorsRef.current,
        nearDoorRoom,
        dogPetFrameRef.current,
        { x: dogRef.current.x, y: dogRef.current.y, state: dogRef.current.state, direction: dogRef.current.direction }
      );
    },
    [ctx, cameraX, cameraY, zoom, size, storeDesks, presences, presenceMap]
  );

  useGameLoop(update, render);

  // --- Mouse/touch input handlers ---

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        mouseDraggedRef.current = false;
        startPan(e.clientX, e.clientY);
      }
    },
    [startPan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        if (dx > 4 || dy > 4) {
          mouseDraggedRef.current = true;
        }
      }
      updatePan(e.clientX, e.clientY);
    },
    [updatePan]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const wasDragging = mouseDraggedRef.current;
      mouseDownPosRef.current = null;
      mouseDraggedRef.current = false;
      endPan();

      if (!wasDragging && e.button === 0 && selectedMemberIdRef.current) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const { zoom: z, cameraX: cx, cameraY: cy } = useOfficeStore.getState();
        const worldX = clickX / z + cx;
        const worldY = clickY / z + cy;

        const gridX = Math.floor(worldX / TILE_SIZE);
        const gridY = Math.floor(worldY / TILE_SIZE);

        if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT) {
          const playerChar = charactersRef.current.find(
            (c) => c.id === selectedMemberIdRef.current
          );
          if (playerChar) {
            // Clicou no proprio personagem — abre menu de emotes
            if (gridX === playerChar.gridX && gridY === playerChar.gridY) {
              setInteractMenu(null);
              setCharMenu({ screenX: e.clientX, screenY: e.clientY });
              return;
            }

            // Clicou em outro personagem — abre menu de interacao
            const targetChar = charactersRef.current.find(
              (c) => c.id !== selectedMemberIdRef.current && c.gridX === gridX && c.gridY === gridY
            );
            if (targetChar) {
              setCharMenu(null);
              setInteractMenu({ screenX: e.clientX, screenY: e.clientY, targetId: targetChar.id, targetName: targetChar.name });
              return;
            }

            // Clicou em outro lugar — fecha menus e move
            setCharMenu(null);
            setInteractMenu(null);
            handleClickMove(gridX, gridY, playerChar);
          }
        }
      }
    },
    [endPan, handleClickMove, canvasRef]
  );

  const handleMouseLeave = useCallback(() => {
    mouseDownPosRef.current = null;
    mouseDraggedRef.current = false;
    endPan();
  }, [endPan]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    },
    [zoomIn, zoomOut]
  );

  // Touch support
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const pinchDistRef = useRef<number | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        lastTouchRef.current = { x: t.clientX, y: t.clientY };
        mouseDownPosRef.current = { x: t.clientX, y: t.clientY };
        mouseDraggedRef.current = false;
        startPan(t.clientX, t.clientY);
      } else if (e.touches.length === 2) {
        endPan();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDistRef.current = Math.hypot(dx, dy);
      }
    },
    [startPan, endPan]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && lastTouchRef.current) {
        const t = e.touches[0];
        if (mouseDownPosRef.current) {
          const dx = Math.abs(t.clientX - mouseDownPosRef.current.x);
          const dy = Math.abs(t.clientY - mouseDownPosRef.current.y);
          if (dx > 8 || dy > 8) mouseDraggedRef.current = true;
        }
        updatePan(t.clientX, t.clientY);
        lastTouchRef.current = { x: t.clientX, y: t.clientY };
      } else if (e.touches.length === 2 && pinchDistRef.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const diff = dist - pinchDistRef.current;
        if (Math.abs(diff) > 30) {
          if (diff > 0) zoomIn();
          else zoomOut();
          pinchDistRef.current = dist;
        }
      }
    },
    [updatePan, zoomIn, zoomOut]
  );

  const handleTouchEnd = useCallback(() => {
    if (!mouseDraggedRef.current && lastTouchRef.current && selectedMemberIdRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const clickX = lastTouchRef.current.x - rect.left;
        const clickY = lastTouchRef.current.y - rect.top;

        const { zoom: z, cameraX: cx, cameraY: cy } = useOfficeStore.getState();
        const worldX = clickX / z + cx;
        const worldY = clickY / z + cy;

        const gridX = Math.floor(worldX / TILE_SIZE);
        const gridY = Math.floor(worldY / TILE_SIZE);

        if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT) {
          const playerChar = charactersRef.current.find(
            (c) => c.id === selectedMemberIdRef.current
          );
          if (playerChar) {
            handleClickMove(gridX, gridY, playerChar);
          }
        }
      }
    }

    lastTouchRef.current = null;
    pinchDistRef.current = null;
    mouseDownPosRef.current = null;
    mouseDraggedRef.current = false;
    endPan();
  }, [endPan, handleClickMove, canvasRef]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-pixel-bg touch-none">
      <canvas
        ref={canvasRef}
        className="block cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />

      {/* Menu do personagem — emotes */}
      {charMenu && (() => {
        const currentState = charactersRef.current.find((c) => c.id === selectedMemberId)?.state;
        const emotes: EmoteState[] = ["dancing", "walking_coffee", "waving", "sitting_floor"];
        return (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setCharMenu(null)}
            />
            <div
              className="fixed z-40 bg-pixel-surface border-2 border-pixel-panel shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)]"
              style={{
                left: charMenu.screenX,
                top: charMenu.screenY - 4,
                transform: "translate(-50%, -100%)",
              }}
            >
              {emotes.map((emote) => (
                <button
                  key={emote}
                  onClick={() => handleEmote(emote)}
                  className={`block px-3 py-2 font-pixel text-[10px] hover:bg-pixel-accent/20 hover:text-pixel-accent transition-colors whitespace-nowrap text-left ${
                    currentState === emote ? "text-pixel-accent bg-pixel-accent/10" : "text-pixel-text"
                  }`}
                >
                  {currentState === emote ? `X ${EMOTE_LABELS[emote]}` : EMOTE_LABELS[emote]}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {/* Menu de interacao com outro jogador */}
      {interactMenu && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setInteractMenu(null)}
          />
          <div
            className="fixed z-40 bg-pixel-surface border-2 border-pixel-panel shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)]"
            style={{
              left: interactMenu.screenX,
              top: interactMenu.screenY - 4,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="px-3 py-1.5 border-b border-pixel-panel/50">
              <span className="font-pixel text-[8px] text-pixel-muted">{interactMenu.targetName}</span>
            </div>
            {INTERACT_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => {
                  emitInteract(interactMenu.targetId, action.id);
                  setInteractMenu(null);
                }}
                className="block w-full px-3 py-2 font-pixel text-[10px] text-pixel-text hover:bg-pixel-accent/20 hover:text-pixel-accent transition-colors whitespace-nowrap text-left"
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Zoom controls — top right */}
      <div className="absolute top-4 right-6 flex flex-col gap-2 z-20">
        <button onClick={zoomIn} className="w-10 h-10 bg-pixel-surface border-2 border-pixel-panel text-pixel-text font-pixel text-base flex items-center justify-center hover:bg-pixel-panel transition-colors" aria-label="Zoom in">+</button>
        <span className="w-10 h-10 bg-pixel-surface/80 border-2 border-pixel-panel text-pixel-text font-pixel text-[11px] flex items-center justify-center">{zoom}x</span>
        <button onClick={zoomOut} className="w-10 h-10 bg-pixel-surface border-2 border-pixel-panel text-pixel-text font-pixel text-base flex items-center justify-center hover:bg-pixel-panel transition-colors" aria-label="Zoom out">-</button>
      </div>

      {/* Top-left indicators */}
      <div className="absolute top-4 left-6 z-20 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-pixel-surface/80 border-2 border-pixel-panel px-4 py-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pixel-blink" />
          <span className="font-pixel text-[10px] text-pixel-muted">LIVE</span>
        </div>
        {(isInCall || voiceJoining) && (
          <div className="flex items-center gap-2 bg-pixel-surface/90 border-2 border-pixel-panel px-4 py-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${voiceJoining ? "bg-yellow-500 animate-pulse" : "bg-green-500"}`} />
            <span className="font-pixel text-[9px] text-pixel-muted">{voiceJoining ? "CONNECTING..." : `VOICE: ${voiceRoomLabel}`}</span>
            {isInCall && participantCount > 1 && <span className="font-pixel text-[8px] text-pixel-accent">({participantCount})</span>}
          </div>
        )}
        {isInCall && voiceParticipants.length > 0 && (
          <div className="bg-pixel-surface/90 border-2 border-pixel-panel px-3 py-2 flex flex-col gap-1 max-w-[180px]">
            {voiceParticipants.map((p) => (
              <div key={p.sessionId} className="flex items-center gap-2">
                {p.isLocal ? (
                  <span className="font-pixel text-[8px] text-pixel-accent">{isMuted ? "🔇" : "🎙️"}</span>
                ) : (
                  <button onClick={() => toggleMuteParticipant(p.sessionId)} className="font-pixel text-[8px] hover:opacity-70 transition-opacity" title={p.isMutedByMe ? `Desmutar ${p.userName}` : `Mutar ${p.userName}`}>{p.isMutedByMe ? "🔇" : "🎙️"}</button>
                )}
                <span className={`font-pixel text-[8px] truncate ${p.isLocal ? "text-pixel-accent" : p.isMutedByMe ? "text-red-400/60" : "text-pixel-text"}`}>{p.userName}{p.isLocal ? " (you)" : ""}</span>
              </div>
            ))}
          </div>
        )}
        {isNearAnyDoor && (
          <div className={`flex items-center gap-2 px-4 py-1.5 border-2 ${isNearRoomLocked ? "bg-red-900/50 border-red-600/50" : "bg-pixel-surface/90 border-pixel-panel"}`}>
            <span className="font-pixel text-[9px] text-pixel-text">{isNearRoomLocked ? "🔒 [SPACE] UNLOCK" : "🔓 [SPACE] LOCK"}</span>
          </div>
        )}
        {!isNearAnyDoor && myRoom >= 0 && lockedDoors.has(myRoom) && (
          <div className="flex items-center gap-2 bg-red-900/50 border-2 border-red-600/50 px-4 py-1.5">
            <span className="font-pixel text-[9px] text-pixel-text">🔒 ROOM LOCKED</span>
          </div>
        )}
        {isNearDog && (
          <div className="flex items-center gap-2 bg-pixel-surface/90 border-2 border-pixel-panel px-4 py-1.5">
            <span className="font-pixel text-[9px] text-pixel-text">🐕 [SPACE] PET</span>
          </div>
        )}
      </div>

      {/* Chat history — above bottom bar, acima da jukebox */}
      {historyOpen && (
        <div className="absolute bottom-28 left-4 z-25 w-[280px]">
          <div className="bg-pixel-surface/95 border-2 border-pixel-panel max-h-[240px] overflow-y-auto">
            <div className="px-4 py-2.5 border-b border-pixel-panel/50 sticky top-0 bg-pixel-surface">
              <span className="font-pixel text-[9px] text-pixel-muted uppercase">Chat</span>
            </div>
            {chatHistory.length === 0 ? (
              <div className="px-4 py-4"><span className="font-pixel text-[8px] text-pixel-muted">Nenhuma mensagem ainda</span></div>
            ) : (
              <div className="px-4 py-2">
                {chatHistory.map((entry) => (
                  <div key={entry.id} className="py-1.5 border-b border-pixel-panel/20 last:border-b-0">
                    <span className="font-pixel text-[8px] text-pixel-accent">{entry.memberName}: </span>
                    <span className="font-pixel text-[8px] text-pixel-text">{entry.message}</span>
                  </div>
                ))}
                <div ref={historyEndRef} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== BOTTOM BAR ========== */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-pixel-surface/95 border-t-2 border-pixel-panel">
        <div className="flex items-center justify-center gap-3 px-4 py-2">
          {/* LEFT: mic, sound, chat toggle, reactions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isSpectator && selectedMemberId && (
              <>
                <button onClick={toggleMute} className={`flex items-center justify-center w-8 h-8 border-2 transition-colors ${isMuted ? "bg-red-900/50 border-red-600/50 hover:border-red-500" : "bg-pixel-panel/50 border-pixel-panel hover:border-pixel-accent"}`} title={isMuted ? "MIC OFF" : "MIC ON"}>
                  <span className="text-sm">{isMuted ? "🔇" : "🎙️"}</span>
                </button>
                <button onClick={toggleSound} className={`flex items-center justify-center w-8 h-8 border-2 transition-colors ${isSoundOff ? "bg-red-900/50 border-red-600/50 hover:border-red-500" : "bg-pixel-panel/50 border-pixel-panel hover:border-pixel-accent"}`} title={isSoundOff ? "SOUND OFF" : "SOUND ON"}>
                  <span className="text-sm">{isSoundOff ? "🔇" : "🔊"}</span>
                </button>
              </>
            )}
            <button onClick={() => setHistoryOpen((v) => !v)} className={`flex items-center justify-center w-8 h-8 border-2 transition-colors ${historyOpen ? "bg-pixel-accent/20 border-pixel-accent" : "bg-pixel-panel/50 border-pixel-panel hover:border-pixel-accent"}`} title="Chat">
              <span className="text-sm">💬</span>
            </button>
            <div className="w-px h-6 bg-pixel-panel/50 mx-0.5" />
            {!isSpectator && selectedMemberId && (
              <div className="flex gap-0.5">
                {["❤️", "👍", "😂", "👏", "🔥", "👀"].map((emoji) => (
                  <button key={emoji} onClick={() => emitReaction(emoji)} className="w-7 h-7 flex items-center justify-center hover:bg-pixel-accent/20 transition-colors text-sm">{emoji}</button>
                ))}
              </div>
            )}
          </div>

          {/* CENTER: chat input */}
          {!isSpectator && selectedMemberId ? (
            <form onSubmit={handleChatSubmit} className="flex gap-2 w-full max-w-[360px] shrink">
              <input ref={chatInputRef} type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onFocus={() => setChatFocused(true)} onBlur={() => setChatFocused(false)} placeholder="Enter para falar..." maxLength={200} className="flex-1 min-w-0 px-3 py-1.5 font-pixel text-[10px] bg-pixel-bg/60 text-pixel-text border-2 border-pixel-panel focus:border-pixel-accent focus:outline-none placeholder:text-pixel-muted/40" />
              <button type="submit" disabled={!chatInput.trim()} className="px-3 py-1.5 font-pixel text-[9px] bg-pixel-accent text-white border-2 border-pixel-accent/60 hover:bg-pixel-accent/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0">SEND</button>
            </form>
          ) : (
            <div className="w-[360px] shrink" />
          )}

          {/* RIGHT: visual editor + settings */}
          <div className="flex items-center gap-1.5 shrink-0">
          {!isSpectator && selectedMemberId && (
            <button
              onClick={onOpenVisualEditor}
              className="flex items-center justify-center w-8 h-8 border-2 bg-pixel-panel/50 border-pixel-panel hover:border-pixel-accent transition-colors"
              title="Personalizar visual"
            >
              <span className="text-sm">👕</span>
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={`flex items-center justify-center w-8 h-8 border-2 transition-colors ${settingsOpen ? "bg-pixel-accent/20 border-pixel-accent" : "bg-pixel-panel/50 border-pixel-panel hover:border-pixel-accent"}`}
              title="Configurações"
            >
              <span className="text-sm">⚙️</span>
            </button>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                <div className="absolute bottom-full right-0 mb-2 z-50 bg-pixel-surface border-2 border-pixel-panel shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] min-w-[180px]">
                  <div className="px-4 py-2.5 border-b border-pixel-panel/50">
                    <span className="font-pixel text-[10px] text-pixel-accent">RAKHA AGENT</span>
                  </div>
                  {selectedMemberName && (
                    <button onClick={() => { clearSelectedMember(); setSettingsOpen(false); }} className="w-full px-4 py-2 font-pixel text-[9px] text-pixel-text hover:bg-pixel-panel/50 text-left transition-colors">
                      Trocar personagem ({selectedMemberName})
                    </button>
                  )}
                  {isSpectator && (
                    <button onClick={() => { clearSelectedMember(); setSettingsOpen(false); }} className="w-full px-4 py-2 font-pixel text-[9px] text-pixel-muted hover:bg-pixel-panel/50 text-left transition-colors">
                      Selecionar personagem
                    </button>
                  )}
                  <button onClick={() => { onToggleSidebar(); setSettingsOpen(false); }} className="w-full px-4 py-2 font-pixel text-[9px] text-pixel-text hover:bg-pixel-panel/50 text-left transition-colors">
                    {sidebarOpen ? "Fechar membros" : `Membros (${characters.length})`}
                  </button>
                  <Link href="/dashboard" onClick={() => setSettingsOpen(false)} className="block w-full px-4 py-2 font-pixel text-[9px] text-pixel-text hover:bg-pixel-panel/50 text-left transition-colors">
                    Dashboard
                  </Link>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
