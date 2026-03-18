import { CharacterState } from "@/types/character";
import { DiscordStatus } from "@/types/discord";

export const TILE_SIZE = 16;
export const GRID_WIDTH = 37;
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
};

// ============================================================
// OFFICE LAYOUT — 37 x 36 grid — 9 ROOMS (3x3)
//
// Each room: 9 wide x 8 tall (interior)
// With walls each room occupies 11 wide x 10 tall
//
// Columns:
//   0: outer wall
//   1: room wall | 2-10: room interior | 11: room wall
//   12: hallway
//   13: room wall | 14-22: room interior | 23: room wall
//   24: hallway
//   25: room wall | 26-34: room interior | 35: room wall
//   36: outer wall
//
// Rows:
//   0: outer wall
//   1: room wall | 2-9: room interior | 10: room wall
//   11-12: hallway
//   13: room wall | 14-21: room interior | 22: room wall
//   23-24: hallway
//   25: room wall | 26-33: room interior | 34: room wall
//   35: outer wall
//
// Tile IDs: 0=empty, 1=wall, 4=hall A, 5=hall B, 6=room A, 7=room B
// ============================================================

interface RoomDef {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

// 9 rooms: 3 columns x 3 rows
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
  }

  return layout;
})();

// Desk position per room — left side of room, facing south
// Desk is 3x2, placed at (room.x + 1, room.y + 1) so character sits at room.y + 3
export const DEFAULT_DESKS = ROOMS.map((room, i) => ({
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

export const ROOM_FURNITURE: RoomFurniture[] = ROOMS.map((room, i) => ({
  roomIndex: i,
  // Desk: offset +3 right, +2 down from room origin (matches DB: room.x+3, room.y+2)
  desk: { x: room.x + 3, y: room.y + 2 },
  // Bed: right side, bottom area (3x2)
  bed: { x: room.x + room.w - 4, y: room.y + room.h - 3 },
  // Coffee corner: right side, top area
  coffee: { x: room.x + room.w - 3, y: room.y },
  // Plant: top-left corner
  plant: { x: room.x, y: room.y },
  // Rug: 3 wide x 1 tall, directly below desk (desk is at +3,+2, desk is 3x1, so rug at +3,+3 is right below)
  rug: { x: room.x + 3, y: room.y + 4, w: 3, h: 1 },
  // Bookshelf: left wall, middle
  bookshelf: { x: room.x, y: room.y + 3 },
  // Lamp: bottom-right corner
  lamp: { x: room.x + room.w - 1, y: room.y + room.h - 1 },
}));

// Overflow areas for unassigned characters
export const COFFEE_AREA = { x: 12, y: 11, width: 2, height: 2 };
export const BED_AREA = { x: 12, y: 23, width: 2, height: 2 };
