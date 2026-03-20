import { CharacterState } from "@/types/character";
import { DiscordStatus } from "@/types/discord";

export const TILE_SIZE = 16;
export const GRID_WIDTH = 53;
export const GRID_HEIGHT = 36;
export const DEFAULT_ZOOM = 2;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.5;

export const CHARACTER_WIDTH = 12;
export const CHARACTER_HEIGHT = 16;

export const DESK_WIDTH = 3;
export const DESK_HEIGHT = 1;

export const BED_WIDTH = 3;
export const BED_HEIGHT = 2;

export const COLORS = {
  // Floor & walls
  floor: "#2c2c54",
  floorAlt: "#34345a",
  floorHall: "#383860",
  floorHallAlt: "#3e3e68",
  floorRoom: "#2a2a50",
  floorRoomAlt: "#303058",
  wall: "#474787",
  wallDark: "#2c2c54",
  wallTop: "#5c5ca0",
  wallDivider: "#3d3d70",
  // Garden
  grass: "#1a4a1a",
  grassAlt: "#1e5520",
  grassLight: "#2d6b2d",
  flowerRed: "#e74c3c",
  flowerYellow: "#f1c40f",
  flowerBlue: "#5dade2",
  flowerPink: "#ff69b4",
  treeTrunk: "#5c3d2e",
  treeLeaf: "#228b22",
  treeLeafDark: "#1a6b1a",
  fence: "#8b7355",
  // Dog
  dogBody: "#c4913b",
  dogBodyDark: "#a07830",
  dogEar: "#8b6914",
  dogNose: "#333333",
  dogTongue: "#e74c3c",
  // Desk
  desk: "#8b6914",
  deskDark: "#6b4f10",
  deskLight: "#a88030",
  deskEdge: "#5a4510",
  // Monitor
  monitor: "#1a1a2e",
  monitorScreen: "#16213e",
  monitorScreenOn: "#0f3460",
  monitorGlow: "#1a4080",
  keyboard: "#2a2a2a",
  // Chair
  chair: "#444444",
  chairSeat: "#555555",
  // Bed
  bed: "#5c3d2e",
  bedSheet: "#a8d8ea",
  bedSheetDark: "#8bc4d6",
  bedPillow: "#ffffff",
  bedPillowShadow: "#dddddd",
  // Coffee
  coffeeMachine: "#333333",
  coffeeCup: "#6f4e37",
  coffeeTable: "#5c3d2e",
  mug: "#ffffff",
  // Decoration
  plant: "#2ecc71",
  plantDark: "#27ae60",
  plantPot: "#8b4513",
  rug: "#4a3060",
  rugBorder: "#5a4070",
  bookshelf: "#6b4513",
  bookColors: ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6"],
  lamp: "#f1c40f",
  lampOff: "#666666",
  poster: "#e94560",
  // Character
  skin: "#ffccaa",
  skinShadow: "#e6a87c",
  hair: "#4a3728",
  shirt: "#3498db",
  pants: "#2c3e50",
  headphones: "#333333",
  headphonesAccent: "#e74c3c",
  zzz: "#95a5a6",
  steam: "#cccccc",
  // Door
  door: "#8b6914",
  doorFrame: "#6b4f10",
  doorLocked: "#8b2020",
  doorLockedFrame: "#5c1515",
  doorHighlight: "#4fc3f7",
} as const;

export const STATUS_COLORS: Record<DiscordStatus, string> = {
  online: "#2ecc71",
  dnd: "#e74c3c",
  idle: "#f1c40f",
  offline: "#95a5a6",
};

export const STATUS_TO_CHARACTER_STATE: Record<DiscordStatus, CharacterState> = {
  online: "typing",
  dnd: "focused",
  idle: "drinking_coffee",
  offline: "sleeping",
};

export const ANIMATION_SPEEDS: Record<CharacterState, number> = {
  typing: 150,
  focused: 500,
  drinking_coffee: 300,
  sleeping: 800,
  walking: 100,
  idle: 600,
  dancing: 180,
  walking_coffee: 120,
  waving: 200,
  sitting_floor: 700,
};

// ============================================================
// OFFICE LAYOUT — 53 x 36 grid
//
// Left side (3x3 grid): 9 personal rooms
// Right side top: Meeting Room (2 lockable doors: left + bottom)
// Right side middle: Café (communal area)
// Right side bottom: Garden (open area, no walls)
//
// Tile IDs: 0=empty, 1=wall, 4/5=hall, 6/7=room, 8/9=grass
// ============================================================

interface RoomDef {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

// 9 personal rooms (3x3) + meeting room + café
export const ROOMS: RoomDef[] = [
  // Row 1 (top)
  { x: 2,  y: 2,  w: 9, h: 8, label: "Room 1" },
  { x: 14, y: 2,  w: 9, h: 8, label: "Room 2" },
  { x: 26, y: 2,  w: 9, h: 8, label: "Room 3" },
  // Row 2 (middle)
  { x: 2,  y: 14, w: 9, h: 8, label: "Room 4" },
  { x: 14, y: 14, w: 9, h: 8, label: "Room 5" },
  { x: 26, y: 14, w: 9, h: 8, label: "Room 6" },
  // Row 3 (bottom)
  { x: 2,  y: 26, w: 9, h: 8, label: "Room 7" },
  { x: 14, y: 26, w: 9, h: 8, label: "Room 8" },
  { x: 26, y: 26, w: 9, h: 8, label: "Room 9" },
  // Meeting room (right side, aligned with row 1)
  { x: 38, y: 2, w: 13, h: 8, label: "Meeting Room" },
  // Café (right side, aligned with row 2)
  { x: 38, y: 14, w: 13, h: 8, label: "Café" },
];

export const MEETING_ROOM_INDEX = 9;
export const CAFE_ROOM_INDEX = 10;

// Gera tiles de porta e triggers internos para qualquer room
interface RoomDoorDef {
  tiles: { x: number; y: number }[];
  insideTrigger: { x: number; y: number }[];
}

function buildRoomDoors(room: RoomDef): RoomDoorDef {
  const doorX = room.x + Math.floor(room.w / 2);
  const tiles: { x: number; y: number }[] = [];
  const insideTrigger: { x: number; y: number }[] = [];

  // Porta inferior (bottom wall)
  tiles.push(
    { x: doorX - 1, y: room.y + room.h },
    { x: doorX, y: room.y + room.h },
    { x: doorX + 1, y: room.y + room.h },
  );
  insideTrigger.push(
    { x: doorX - 1, y: room.y + room.h - 1 },
    { x: doorX, y: room.y + room.h - 1 },
    { x: doorX + 1, y: room.y + room.h - 1 },
  );

  // Porta superior (top wall)
  tiles.push(
    { x: doorX - 1, y: room.y - 1 },
    { x: doorX, y: room.y - 1 },
    { x: doorX + 1, y: room.y - 1 },
  );
  insideTrigger.push(
    { x: doorX - 1, y: room.y },
    { x: doorX, y: room.y },
    { x: doorX + 1, y: room.y },
  );

  // Meeting room + Café: porta esquerda extra
  if (room.label === "Meeting Room" || room.label === "Café") {
    const doorY = room.y + Math.floor(room.h / 2);
    tiles.push(
      { x: room.x - 1, y: doorY - 1 },
      { x: room.x - 1, y: doorY },
      { x: room.x - 1, y: doorY + 1 },
    );
    insideTrigger.push(
      { x: room.x, y: doorY - 1 },
      { x: room.x, y: doorY },
      { x: room.x, y: doorY + 1 },
    );
  }

  return { tiles, insideTrigger };
}

// Portas de todas as rooms (todas trancáveis)
export const ROOM_DOORS: RoomDoorDef[] = ROOMS.map(buildRoomDoors);

// Atalho legado (meeting room = index 9)
export const MEETING_DOOR = ROOM_DOORS[MEETING_ROOM_INDEX];

// Jardim (area aberta sem paredes, abaixo do café)
export const GARDEN = {
  x: 38,
  y: 24,
  w: 13,
  h: 10,
};

// Cachorrinho interativo no jardim
export const DOG_POSITION = { x: 44, y: 28 };
// Tiles adjacentes ao cachorro onde o jogador pode interagir
export const DOG_INTERACT_TILES = [
  { x: 43, y: 28 },
  { x: 45, y: 28 },
  { x: 44, y: 27 },
  { x: 44, y: 29 },
];

const W = GRID_WIDTH;
const H = GRID_HEIGHT;

export const OFFICE_LAYOUT: number[][] = (() => {
  const layout: number[][] = [];

  // Fill with empty
  for (let y = 0; y < H; y++) {
    layout.push(new Array(W).fill(0));
  }

  const set = (x: number, y: number, val: number) => {
    if (y >= 0 && y < H && x >= 0 && x < W) layout[y][x] = val;
  };

  // Outer boundary walls
  for (let x = 0; x < W; x++) { set(x, 0, 1); set(x, H - 1, 1); }
  for (let y = 0; y < H; y++) { set(0, y, 1); set(W - 1, y, 1); }

  // Fill entire interior with hallway floor
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      set(x, y, (x + y) % 2 === 0 ? 4 : 5);
    }
  }

  // Draw each room: walls + interior floor
  for (const room of ROOMS) {
    const { x: rx, y: ry, w: rw, h: rh } = room;

    // Walls around room
    for (let x = rx - 1; x <= rx + rw; x++) {
      set(x, ry - 1, 1);   // top wall
      set(x, ry + rh, 1);  // bottom wall
    }
    for (let y = ry - 1; y <= ry + rh; y++) {
      set(rx - 1, y, 1);   // left wall
      set(rx + rw, y, 1);  // right wall
    }

    // Room interior floor (darker)
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        set(x, y, (x + y) % 2 === 0 ? 6 : 7);
      }
    }

    // Door opening at bottom center (3 tiles wide)
    const doorX = rx + Math.floor(rw / 2);
    set(doorX - 1, ry + rh, (doorX - 1 + ry + rh) % 2 === 0 ? 4 : 5);
    set(doorX, ry + rh, (doorX + ry + rh) % 2 === 0 ? 4 : 5);
    set(doorX + 1, ry + rh, (doorX + 1 + ry + rh) % 2 === 0 ? 4 : 5);

    // Door opening at top center (3 tiles wide)
    set(doorX - 1, ry - 1, (doorX - 1 + ry - 1) % 2 === 0 ? 4 : 5);
    set(doorX, ry - 1, (doorX + ry - 1) % 2 === 0 ? 4 : 5);
    set(doorX + 1, ry - 1, (doorX + 1 + ry - 1) % 2 === 0 ? 4 : 5);

    // Meeting room + Café: porta na parede esquerda (3 tiles, centro vertical)
    if (room.label === "Meeting Room" || room.label === "Café") {
      const doorY = ry + Math.floor(rh / 2);
      set(rx - 1, doorY - 1, (rx - 1 + doorY - 1) % 2 === 0 ? 4 : 5);
      set(rx - 1, doorY, (rx - 1 + doorY) % 2 === 0 ? 4 : 5);
      set(rx - 1, doorY + 1, (rx - 1 + doorY + 1) % 2 === 0 ? 4 : 5);
    }
  }

  // Garden area — grama sem paredes (substitui hallway tiles)
  for (let y = GARDEN.y; y < GARDEN.y + GARDEN.h && y < H - 1; y++) {
    for (let x = GARDEN.x; x < GARDEN.x + GARDEN.w && x < W - 1; x++) {
      set(x, y, (x + y) % 2 === 0 ? 8 : 9);
    }
  }
  // Remove paredes na divisa entre hallway e jardim (lado esquerdo do jardim)
  for (let y = GARDEN.y; y < GARDEN.y + GARDEN.h && y < H - 1; y++) {
    const leftWall = GARDEN.x - 1;
    if (leftWall > 0) {
      const tile = layout[y]?.[leftWall];
      if (tile === 1) set(leftWall, y, (leftWall + y) % 2 === 0 ? 4 : 5);
    }
  }

  return layout;
})();

// Desk position per room — left side of room, facing south
export const DEFAULT_DESKS = ROOMS.slice(0, 9).map((room, i) => ({
  id: `desk-${i + 1}`,
  gridX: room.x + 3,
  gridY: room.y + 2,
  direction: "south" as const,
  label: `Desk ${i + 1}`,
  assignedMemberId: null,
}));

// Room furniture positions — each room has desk, bed, coffee, plant, rug, bookshelf, lamp
export interface RoomFurniture {
  roomIndex: number;
  desk: { x: number; y: number };
  bed: { x: number; y: number };
  coffee: { x: number; y: number };
  plant: { x: number; y: number };
  rug: { x: number; y: number; w: number; h: number };
  bookshelf: { x: number; y: number };
  lamp: { x: number; y: number };
}

// Moveis apenas para as 9 rooms pessoais (nao inclui meeting room nem café)
export const ROOM_FURNITURE: RoomFurniture[] = ROOMS.slice(0, 9).map((room, i) => ({
  roomIndex: i,
  desk: { x: room.x + 3, y: room.y + 2 },
  bed: { x: room.x + room.w - 4, y: room.y + room.h - 3 },
  coffee: { x: room.x + room.w - 3, y: room.y },
  plant: { x: room.x, y: room.y },
  rug: { x: room.x + 3, y: room.y + 4, w: 3, h: 1 },
  bookshelf: { x: room.x, y: room.y + 3 },
  lamp: { x: room.x + room.w - 1, y: room.y + room.h - 1 },
}));

// Tiles bloqueadas estaticas (mobilia, arvores, cerca, mesa da meeting room)
export const STATIC_BLOCKED_TILES: { x: number; y: number }[] = (() => {
  const tiles: { x: number; y: number }[] = [];

  // Mesa da meeting room (7 wide x 4 tall, centralizada) + 1 tile ao redor para cadeiras
  const mr = ROOMS[MEETING_ROOM_INDEX];
  const mtW = 7;
  const mtH = 4;
  const mtX = mr.x + Math.floor((mr.w - mtW) / 2);
  const mtY = mr.y + Math.floor((mr.h - mtH) / 2);
  for (let y = mtY - 1; y <= mtY + mtH; y++) {
    for (let x = mtX; x < mtX + mtW; x++) {
      tiles.push({ x, y });
    }
  }

  // Mesas do café (3 wide x 2 tall cada) + balcão (2x3)
  const cafe = ROOMS[CAFE_ROOM_INDEX];
  const cafeTables = [
    { x: cafe.x + 2, y: cafe.y + 1, w: 3, h: 2 },
    { x: cafe.x + 7, y: cafe.y + 1, w: 3, h: 2 },
  ];
  for (const ct of cafeTables) {
    for (let y = ct.y; y < ct.y + ct.h; y++) {
      for (let x = ct.x; x < ct.x + ct.w; x++) {
        tiles.push({ x, y });
      }
    }
  }
  // Balcão do café (2x3 no canto superior direito)
  const barX = cafe.x + cafe.w - 3;
  const barY = cafe.y;
  for (let y = barY; y < barY + 3; y++) {
    for (let x = barX; x < barX + 2; x++) {
      tiles.push({ x, y });
    }
  }

  // Cerca do jardim (toda a borda superior)
  for (let x = GARDEN.x; x < GARDEN.x + GARDEN.w; x++) {
    tiles.push({ x, y: GARDEN.y });
  }

  // Arvores do jardim (2x2 cada)
  const treeBases = [
    { x: GARDEN.x, y: GARDEN.y },
    { x: GARDEN.x + GARDEN.w - 2, y: GARDEN.y + GARDEN.h - 3 },
    { x: GARDEN.x + 5, y: GARDEN.y + GARDEN.h - 2 },
  ];
  for (const t of treeBases) {
    tiles.push({ x: t.x, y: t.y });
    tiles.push({ x: t.x + 1, y: t.y });
    tiles.push({ x: t.x, y: t.y + 1 });
    tiles.push({ x: t.x + 1, y: t.y + 1 });
  }

  // Cachorro bloqueia seu tile
  tiles.push(DOG_POSITION);

  return tiles;
})();

// Overflow areas for unassigned characters (inside café room)
export const COFFEE_AREA = { x: 40, y: 16, width: 3, height: 2 };
export const BED_AREA = { x: 46, y: 16, width: 3, height: 2 };
