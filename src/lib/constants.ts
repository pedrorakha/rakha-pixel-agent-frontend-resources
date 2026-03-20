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
  // Stone path
  stone: "#6b6b80",
  stoneAlt: "#5e5e72",
  // Dog (cores padrao — usadas como fallback)
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
// Row 1: Room1, Room2, Room3, Meeting Room
// Row 2: Room4, Garden (open), Café (open), Room5
// Row 3: Room6, Room7, Room8, Room9
//
// Garden e Café ficam no centro, sem paredes (áreas abertas)
// Tile IDs: 0=empty, 1=wall, 4/5=hall, 6/7=room, 8/9=grass
// ============================================================

interface RoomDef {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

// 9 personal rooms + meeting room (café é área aberta, fora do ROOMS)
// Layout: quartos ao redor, garden + café no centro
// Room5 e Room9 encostados na borda direita (x:42, w:9 → right wall alinha com Meeting Room)
export const ROOMS: RoomDef[] = [
  // Row 1 (top)
  { x: 2,  y: 2,  w: 9, h: 8, label: "Room 1" },
  { x: 14, y: 2,  w: 9, h: 8, label: "Room 2" },
  { x: 26, y: 2,  w: 9, h: 8, label: "Room 3" },
  // Row 2 (sides — centro é garden + café)
  { x: 2,  y: 14, w: 9, h: 8, label: "Room 4" },
  { x: 42, y: 14, w: 9, h: 8, label: "Room 5" },
  // Row 3 (bottom)
  { x: 2,  y: 26, w: 9, h: 8, label: "Room 6" },
  { x: 14, y: 26, w: 9, h: 8, label: "Room 7" },
  { x: 26, y: 26, w: 9, h: 8, label: "Room 8" },
  { x: 42, y: 26, w: 9, h: 8, label: "Room 9" },
  // Meeting room (top right, maior)
  { x: 38, y: 2, w: 13, h: 8, label: "Meeting Room" },
];

export const MEETING_ROOM_INDEX = 9;

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

  // Portas laterais (esquerda e direita) para todas as rooms
  const doorY = room.y + Math.floor(room.h / 2);

  // Porta esquerda
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

  // Porta direita
  tiles.push(
    { x: room.x + room.w, y: doorY - 1 },
    { x: room.x + room.w, y: doorY },
    { x: room.x + room.w, y: doorY + 1 },
  );
  insideTrigger.push(
    { x: room.x + room.w - 1, y: doorY - 1 },
    { x: room.x + room.w - 1, y: doorY },
    { x: room.x + room.w - 1, y: doorY + 1 },
  );

  return { tiles, insideTrigger };
}

// Portas de todas as rooms (todas trancáveis)
export const ROOM_DOORS: RoomDoorDef[] = ROOMS.map(buildRoomDoors);

// Atalho legado (meeting room = index 9)
export const MEETING_DOOR = ROOM_DOORS[MEETING_ROOM_INDEX];

// Jardim (area aberta sem paredes, centro-esquerdo do mapa)
export const GARDEN = {
  x: 14,
  y: 13,
  w: 12,
  h: 10,
};

// Coluna de pedra separando garden e café (1 tile de largura)
export const STONE_PATH = {
  x: 26,
  y: 13,
  h: 10,
};

// Café (area aberta sem paredes, centro-direito do mapa)
export const CAFE = {
  x: 27,
  y: 13,
  w: 12,
  h: 10,
};

// Paleta de cores por cachorro
export interface DogColors {
  body: string;
  bodyDark: string;
  ear: string;
  snout: string;
  belly: string;
  spots?: { x: number; y: number; w: number; h: number; color: string }[];
}

export interface DogDefinition {
  name: string;
  position: { x: number; y: number };
  colors: DogColors;
  collarColor: string;
}

// Cachorrinhos interativos no jardim
export const DOGS: DogDefinition[] = [
  {
    name: "Nala",
    position: { x: 20, y: 18 },
    colors: {
      body: "#c4913b",
      bodyDark: "#a07830",
      ear: "#8b6914",
      snout: "#d4a84a",
      belly: "#d4a84a",
    },
    collarColor: "#e74c3c",
  },
  {
    name: "Boris",
    position: { x: 17, y: 16 },
    colors: {
      body: "#2a2a2a",
      bodyDark: "#1a1a1a",
      ear: "#1a1a1a",
      snout: "#e8e8e8",
      belly: "#e8e8e8",
    },
    collarColor: "#3498db",
  },
  {
    name: "Alasca",
    position: { x: 22, y: 16 },
    colors: {
      body: "#f0f0f0",
      bodyDark: "#d0d0d0",
      ear: "#e0d8d0",
      snout: "#f5e6d0",
      belly: "#f5e6d0",
      spots: [{ x: 5, y: 6, w: 3, h: 2, color: "#2a2a2a" }],
    },
    collarColor: "#e91e63",
  },
  {
    name: "Meg",
    position: { x: 19, y: 20 },
    colors: {
      body: "#a0a0a0",
      bodyDark: "#787878",
      ear: "#222222",
      snout: "#b8b8b8",
      belly: "#b8b8b8",
      spots: [
        { x: 4, y: 5, w: 3, h: 3, color: "#1a1a1a" },
        { x: 8, y: 7, w: 3, h: 2, color: "#222222" },
        { x: 5, y: 10, w: 2, h: 2, color: "#1a1a1a" },
      ],
    },
    collarColor: "#9b59b6",
  },
];

// Compatibilidade — posicao do primeiro cachorro
export const DOG_POSITION = DOGS[0].position;

// Lounge entre Room 8 e Room 9 (3 tiles centrais do gap de 5)
export const LOUNGE = {
  x: 37,
  y: 26,
  w: 3,
  h: 8,
};

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

    // Door opening left wall (3 tiles, centro vertical)
    const doorY = ry + Math.floor(rh / 2);
    set(rx - 1, doorY - 1, (rx - 1 + doorY - 1) % 2 === 0 ? 4 : 5);
    set(rx - 1, doorY, (rx - 1 + doorY) % 2 === 0 ? 4 : 5);
    set(rx - 1, doorY + 1, (rx - 1 + doorY + 1) % 2 === 0 ? 4 : 5);

    // Door opening right wall (3 tiles, centro vertical)
    set(rx + rw, doorY - 1, (rx + rw + doorY - 1) % 2 === 0 ? 4 : 5);
    set(rx + rw, doorY, (rx + rw + doorY) % 2 === 0 ? 4 : 5);
    set(rx + rw, doorY + 1, (rx + rw + doorY + 1) % 2 === 0 ? 4 : 5);
  }

  // Garden area — grama sem paredes (área aberta no centro)
  for (let y = GARDEN.y; y < GARDEN.y + GARDEN.h && y < H - 1; y++) {
    for (let x = GARDEN.x; x < GARDEN.x + GARDEN.w && x < W - 1; x++) {
      set(x, y, (x + y) % 2 === 0 ? 8 : 9);
    }
  }

  // Stone path — separação entre garden e café
  for (let y = STONE_PATH.y; y < STONE_PATH.y + STONE_PATH.h && y < H - 1; y++) {
    set(STONE_PATH.x, y, (STONE_PATH.x + y) % 2 === 0 ? 10 : 11);
  }

  // Café area — piso sem paredes (área aberta no centro)
  for (let y = CAFE.y; y < CAFE.y + CAFE.h && y < H - 1; y++) {
    for (let x = CAFE.x; x < CAFE.x + CAFE.w && x < W - 1; x++) {
      set(x, y, (x + y) % 2 === 0 ? 6 : 7);
    }
  }

  // Lounge — piso de pedra entre Room 8 e Room 9
  for (let y = LOUNGE.y; y < LOUNGE.y + LOUNGE.h && y < H - 1; y++) {
    for (let x = LOUNGE.x; x < LOUNGE.x + LOUNGE.w && x < W - 1; x++) {
      set(x, y, (x + y) % 2 === 0 ? 10 : 11);
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
  bookshelf: { x: room.x, y: room.y + 1 },
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
  const cafeTables = [
    { x: CAFE.x + 2, y: CAFE.y + 4, w: 3, h: 2 },
    { x: CAFE.x + 7, y: CAFE.y + 4, w: 3, h: 2 },
  ];
  for (const ct of cafeTables) {
    for (let y = ct.y; y < ct.y + ct.h; y++) {
      for (let x = ct.x; x < ct.x + ct.w; x++) {
        tiles.push({ x, y });
      }
    }
  }
  // Balcão do café (2x3 no canto superior direito)
  const barX = CAFE.x + CAFE.w - 3;
  const barY = CAFE.y;
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

  // Cachorro tem posicao dinamica — bloqueio tratado no game loop

  // Lounge — bebedouro (topo) e banco (centro)
  // Bebedouro: 1 tile no topo central
  tiles.push({ x: LOUNGE.x + 1, y: LOUNGE.y + 1 });
  // Banco: 3 tiles wide no centro
  for (let x = LOUNGE.x; x < LOUNGE.x + LOUNGE.w; x++) {
    tiles.push({ x, y: LOUNGE.y + 4 });
  }
  // Planta: 1 tile no fundo central
  tiles.push({ x: LOUNGE.x + 1, y: LOUNGE.y + 6 });

  return tiles;
})();

// Overflow areas for unassigned characters (inside café area)
export const COFFEE_AREA = { x: CAFE.x + 1, y: CAFE.y + 4, width: 3, height: 2 };
export const BED_AREA = { x: CAFE.x + 8, y: CAFE.y + 4, width: 3, height: 2 };
