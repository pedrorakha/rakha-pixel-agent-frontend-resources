"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvas } from "@/hooks/use-canvas";
import { useGameLoop } from "@/hooks/use-game-loop";
import { useOfficeStore } from "@/stores/office-store";
import { useDiscordStore } from "@/stores/discord-store";
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

export function OfficeCanvas() {
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

  const [characters, setCharacters] = useState<Character[]>([]);
  const [presenceMap, setPresenceMap] = useState<Map<string, DiscordStatus>>(new Map());
  const rendererRef = useRef<Renderer | null>(null);
  const tilemapRef = useRef<Tilemap | null>(null);
  const charactersRef = useRef<Character[]>(characters);

  // Keep ref in sync
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

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

        // Convert API desks to store Desk format and update the store
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

        // Build presence map from API data
        const newPresenceMap = new Map<string, DiscordStatus>();

        // Build a map: desk_id -> room index (to find which room a desk belongs to)
        const deskToRoom = new Map<string, number>();
        for (const apiDesk of (apiDesks ?? [])) {
          // Find which room this desk is inside by checking position
          for (let ri = 0; ri < ROOMS.length; ri++) {
            const room = ROOMS[ri];
            if (apiDesk.grid_x >= room.x && apiDesk.grid_x < room.x + room.w &&
                apiDesk.grid_y >= room.y && apiDesk.grid_y < room.y + room.h) {
              deskToRoom.set(apiDesk.id, ri);
              break;
            }
          }
        }

        // Map API members to Character objects
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
                // SLEEPING → go to bed in their room
                gridX = roomFurn.bed.x + 1;
                gridY = roomFurn.bed.y;
                direction = "right";
              } else if (status === "idle" && roomFurn) {
                // COFFEE → go to coffee corner in their room
                gridX = roomFurn.coffee.x;
                gridY = roomFurn.coffee.y + 1;
                direction = "right";
              } else {
                // ONLINE / DND → sit at desk
                const deskDir = API_DIRECTION_MAP[desk.direction] ?? "down";
                direction = deskDir;
                gridX = desk.grid_x;
                gridY = desk.grid_y + 1;
                if (deskDir === "up") { gridX = desk.grid_x; gridY = desk.grid_y - 1; }
                else if (deskDir === "left") { gridX = desk.grid_x - 1; gridY = desk.grid_y; }
                else if (deskDir === "right") { gridX = desk.grid_x + 2; gridY = desk.grid_y; }
              }
            } else if (status === "idle" || status === "dnd") {
              // No desk assigned → overflow coffee area
              gridX = COFFEE_AREA.x + (coffeeIndex % COFFEE_AREA.width);
              gridY = COFFEE_AREA.y + Math.floor(coffeeIndex / COFFEE_AREA.width);
              coffeeIndex++;
              direction = "right";
            } else {
              // No desk assigned → overflow bed area
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
              colorShirt: m.color_shirt || color,
              colorHair: m.color_hair || "#4a3728",
              colorSkin: m.color_skin || "#ffccaa",
            } satisfies Character;
          });

        setCharacters(chars);
        setPresenceMap(newPresenceMap);
      } catch (err) {
        // Silently fail - canvas will just show empty office
        console.error("Failed to fetch office data:", err);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [setDesks]);

  // Initialize tilemap and renderer
  useEffect(() => {
    const tilemap = new Tilemap(layout);
    tilemapRef.current = tilemap;
    const renderer = new Renderer(tilemap);
    rendererRef.current = renderer;
  }, [layout]);

  // Update renderer context when it changes
  useEffect(() => {
    if (ctx && rendererRef.current) {
      rendererRef.current.setContext(ctx);
    }
  }, [ctx]);

  // Update character states AND positions in real-time when discord presence changes via WebSocket
  useEffect(() => {
    if (presences.size === 0) return;

    setCharacters((prev) =>
      prev.map((char) => {
        const presence = presences.get(char.discordId);
        if (!presence) return char;
        const newState = STATUS_TO_STATE[presence.status];
        if (newState === char.state) return char;

        // Reposition character based on new status
        let newX = char.gridX;
        let newY = char.gridY;
        let newDir = char.direction;

        if (char.deskId) {
          // Find which room this character's desk is in
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
            // Go to bed
            newX = roomFurn.bed.x + 1;
            newY = roomFurn.bed.y;
            newDir = "right";
          } else if (presence.status === "idle" && roomFurn) {
            // Go to coffee
            newX = roomFurn.coffee.x;
            newY = roomFurn.coffee.y + 1;
            newDir = "right";
          } else if (desk) {
            // Back to desk
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

    // Also update the presence map for rendering
    setPresenceMap((prev) => {
      const updated = new Map(prev);
      presences.forEach((p, discordId) => {
        updated.set(discordId, p.status);
      });
      return updated;
    });
  }, [presences, storeDesks]);

  const update = useCallback(
    (deltaTime: number) => {
      setCharacters((prev) => updateCharacterAnimations(prev, deltaTime));
    },
    []
  );

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

      // Build presence map - merge API data and live presences
      const mergedPresenceMap = new Map<string, DiscordStatus>(presenceMap);
      presences.forEach((p, discordId) => {
        mergedPresenceMap.set(discordId, p.status);
      });

      rendererRef.current.render(
        gameState,
        storeDesks,
        charactersRef.current,
        mergedPresenceMap
      );
    },
    [ctx, cameraX, cameraY, zoom, size, storeDesks, presences, presenceMap]
  );

  useGameLoop(update, render);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        startPan(e.clientX, e.clientY);
      }
    },
    [startPan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updatePan(e.clientX, e.clientY);
    },
    [updatePan]
  );

  const handleMouseUp = useCallback(() => {
    endPan();
  }, [endPan]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    },
    [zoomIn, zoomOut]
  );

  return (
    <div className="relative w-full h-full overflow-hidden bg-pixel-bg">
      <canvas
        ref={canvasRef}
        className="block cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Zoom controls overlay */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="w-8 h-8 bg-pixel-surface border-2 border-pixel-panel text-pixel-text font-pixel text-sm flex items-center justify-center hover:bg-pixel-panel transition-colors"
          aria-label="Zoom in"
        >
          +
        </button>
        <span className="w-8 h-8 bg-pixel-surface/80 border-2 border-pixel-panel text-pixel-text font-pixel text-[8px] flex items-center justify-center">
          {zoom}x
        </span>
        <button
          onClick={zoomOut}
          className="w-8 h-8 bg-pixel-surface border-2 border-pixel-panel text-pixel-text font-pixel text-sm flex items-center justify-center hover:bg-pixel-panel transition-colors"
          aria-label="Zoom out"
        >
          -
        </button>
      </div>

      {/* Connection status */}
      <div className="absolute top-12 left-4">
        <div className="flex items-center gap-2 bg-pixel-surface/80 border-2 border-pixel-panel px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pixel-blink" />
          <span className="font-pixel text-[7px] text-pixel-muted">LIVE</span>
        </div>
      </div>
    </div>
  );
}
