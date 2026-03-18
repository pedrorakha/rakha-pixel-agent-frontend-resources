"use client";

import { useRef, useEffect, useCallback } from "react";
import { Character } from "@/types/character";
import { Tilemap } from "@/engine/tilemap";
import { findPath } from "@/engine/pathfinding";
import { Point } from "@/engine/types";
import { TILE_SIZE, OFFICE_LAYOUT } from "@/lib/constants";
import { Desk } from "@/types/office";

const MOVE_SPEED = 5; // tiles per second
const MOVE_INTERVAL = 1 / MOVE_SPEED; // seconds between tile moves

interface MovementState {
  isMoving: boolean;
  moveTimer: number;
  path: Point[];
  pathIndex: number;
  keysDown: Record<string, boolean>;
}

interface UsePlayerMovementOptions {
  playerId: string | null;
  tilemap: Tilemap | null;
  desks: Desk[];
  characters: Character[];
  onMove: (gridX: number, gridY: number, direction: Character["direction"]) => void;
}

// Preenche mapa de colisao com moveis e mesas
function buildBlockedSet(desks: Desk[], characters: Character[], playerId: string): Set<string> {
  const blocked = new Set<string>();

  // Mesas ocupam 3x1 tiles
  for (const desk of desks) {
    for (let dx = 0; dx < 3; dx++) {
      blocked.add(`${desk.gridX + dx},${desk.gridY}`);
    }
  }

  // Outros personagens bloqueiam sua posicao
  for (const char of characters) {
    if (char.id === playerId) continue;
    blocked.add(`${char.gridX},${char.gridY}`);
  }

  return blocked;
}

function isWalkable(
  x: number,
  y: number,
  tilemap: Tilemap,
  blocked: Set<string>
): boolean {
  if (!tilemap.isWalkable(x, y)) return false;
  if (blocked.has(`${x},${y}`)) return false;
  return true;
}

function directionFromDelta(dx: number, dy: number): Character["direction"] {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

export function usePlayerMovement({
  playerId,
  tilemap,
  desks,
  characters,
  onMove,
}: UsePlayerMovementOptions) {
  const stateRef = useRef<MovementState>({
    isMoving: false,
    moveTimer: 0,
    path: [],
    pathIndex: 0,
    keysDown: {},
  });

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const tilemapRef = useRef(tilemap);
  tilemapRef.current = tilemap;

  const desksRef = useRef(desks);
  desksRef.current = desks;

  const charactersRef = useRef(characters);
  charactersRef.current = characters;

  // Teclado — WASD e setas
  useEffect(() => {
    if (!playerId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se um input/textarea esta focado
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
        stateRef.current.keysDown[key] = true;
        // Cancela path ao usar teclado
        stateRef.current.path = [];
        stateRef.current.pathIndex = 0;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      stateRef.current.keysDown[key] = false;
    };

    // Limpa teclas ao perder foco
    const handleBlur = () => {
      stateRef.current.keysDown = {};
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [playerId]);

  // Retorna direcao baseada nas teclas pressionadas
  const getKeyDirection = useCallback((): { dx: number; dy: number } | null => {
    const keys = stateRef.current.keysDown;
    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;

    if (dx === 0 && dy === 0) return null;

    // Prioriza um eixo se ambos pressionados
    if (dx !== 0 && dy !== 0) {
      dy = 0;
    }

    return { dx, dy };
  }, []);

  // Click para mover — calcula caminho BFS
  const handleClickMove = useCallback(
    (targetGridX: number, targetGridY: number, currentChar: Character) => {
      if (!tilemapRef.current || !playerId) return;

      const blocked = buildBlockedSet(desksRef.current, charactersRef.current, playerId);

      // Constroi collision map para BFS
      const height = OFFICE_LAYOUT.length;
      const width = OFFICE_LAYOUT[0].length;
      const collisionMap: boolean[][] = [];
      for (let y = 0; y < height; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < width; x++) {
          row.push(!isWalkable(x, y, tilemapRef.current!, blocked));
        }
        collisionMap.push(row);
      }

      // Permite destino mesmo que bloqueado (vai ate o mais proximo)
      const start: Point = { x: currentChar.gridX, y: currentChar.gridY };
      const end: Point = { x: targetGridX, y: targetGridY };

      const path = findPath(collisionMap, start, end);
      if (path.length > 1) {
        stateRef.current.path = path;
        stateRef.current.pathIndex = 1; // Pula posicao atual
        stateRef.current.moveTimer = 0;
      }
    },
    [playerId]
  );

  // Update chamado pelo game loop a cada tick
  const updateMovement = useCallback(
    (deltaTime: number, currentChar: Character | undefined) => {
      if (!currentChar || !tilemapRef.current || !playerId) return;

      stateRef.current.moveTimer += deltaTime;
      if (stateRef.current.moveTimer < MOVE_INTERVAL) return;
      stateRef.current.moveTimer = 0;

      const blocked = buildBlockedSet(desksRef.current, charactersRef.current, playerId);
      const tm = tilemapRef.current;

      // Prioridade 1: teclado
      const keyDir = getKeyDirection();
      if (keyDir) {
        const nx = currentChar.gridX + keyDir.dx;
        const ny = currentChar.gridY + keyDir.dy;
        if (isWalkable(nx, ny, tm, blocked)) {
          const dir = directionFromDelta(keyDir.dx, keyDir.dy);
          onMoveRef.current(nx, ny, dir);
        }
        return;
      }

      // Prioridade 2: path de click
      const { path, pathIndex } = stateRef.current;
      if (path.length > 0 && pathIndex < path.length) {
        const next = path[pathIndex];
        if (isWalkable(next.x, next.y, tm, blocked)) {
          const dx = next.x - currentChar.gridX;
          const dy = next.y - currentChar.gridY;
          const dir = directionFromDelta(dx, dy);
          onMoveRef.current(next.x, next.y, dir);
          stateRef.current.pathIndex++;
        } else {
          // Caminho bloqueado, cancela
          stateRef.current.path = [];
          stateRef.current.pathIndex = 0;
        }
      }
    },
    [playerId, getKeyDirection]
  );

  // Verifica se ha input ativo (teclado ou path)
  const hasActiveInput = useCallback((): boolean => {
    const keyDir = getKeyDirection();
    if (keyDir) return true;
    const { path, pathIndex } = stateRef.current;
    return path.length > 0 && pathIndex < path.length;
  }, [getKeyDirection]);

  return {
    updateMovement,
    handleClickMove,
    hasActiveInput,
  };
}
