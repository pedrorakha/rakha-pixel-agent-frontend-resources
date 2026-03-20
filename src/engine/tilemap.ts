import { TILE_SIZE, COLORS } from "@/lib/constants";
import { TileData, TileType, GameState } from "./types";

const TILE_DEFS: Record<number, TileData> = {
  0: { type: "empty", walkable: false, color: "#0a0a15" },
  1: { type: "wall", walkable: false, color: COLORS.wall },
  2: { type: "floor", walkable: true, color: COLORS.floor },
  3: { type: "floor_alt", walkable: true, color: COLORS.floorAlt },
  4: { type: "floor", walkable: true, color: COLORS.floorHall ?? "#383860" },
  5: { type: "floor_alt", walkable: true, color: COLORS.floorHallAlt ?? "#3e3e68" },
  6: { type: "floor", walkable: true, color: COLORS.floorRoom ?? "#2a2a50" },
  7: { type: "floor_alt", walkable: true, color: COLORS.floorRoomAlt ?? "#303058" },
  8: { type: "floor", walkable: true, color: COLORS.grass ?? "#1a4a1a" },
  9: { type: "floor_alt", walkable: true, color: COLORS.grassAlt ?? "#1e5520" },
  10: { type: "floor", walkable: true, color: COLORS.stone ?? "#6b6b80" },
  11: { type: "floor_alt", walkable: true, color: COLORS.stoneAlt ?? "#5e5e72" },
};

export class Tilemap {
  private tiles: number[][];
  private width: number;
  private height: number;

  constructor(tiles: number[][]) {
    this.tiles = tiles;
    this.height = tiles.length;
    this.width = tiles.length > 0 ? tiles[0].length : 0;
  }

  getTileAt(x: number, y: number): TileData | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    const tileId = this.tiles[y][x];
    return TILE_DEFS[tileId] ?? TILE_DEFS[0];
  }

  getTileType(x: number, y: number): TileType | null {
    const tile = this.getTileAt(x, y);
    return tile ? tile.type : null;
  }

  isWalkable(x: number, y: number): boolean {
    const tile = this.getTileAt(x, y);
    return tile ? tile.walkable : false;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  render(ctx: CanvasRenderingContext2D, state: GameState): void {
    const { camera, canvasWidth, canvasHeight } = state;
    const scaledTile = TILE_SIZE * camera.zoom;

    const startX = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    const startY = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    const endX = Math.min(
      this.width,
      Math.ceil((camera.x + canvasWidth / camera.zoom) / TILE_SIZE) + 1
    );
    const endY = Math.min(
      this.height,
      Math.ceil((camera.y + canvasHeight / camera.zoom) / TILE_SIZE) + 1
    );

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = this.getTileAt(x, y);
        if (!tile || tile.type === "empty") continue;

        const screenX = (x * TILE_SIZE - camera.x) * camera.zoom;
        const screenY = (y * TILE_SIZE - camera.y) * camera.zoom;

        ctx.fillStyle = tile.color;
        ctx.fillRect(screenX, screenY, scaledTile + 1, scaledTile + 1);

        // Wall rendering
        if (tile.type === "wall") {
          // Top highlight
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(screenX, screenY, scaledTile + 1, 3 * camera.zoom);
          // Bottom shadow
          ctx.fillStyle = COLORS.wallDark;
          ctx.fillRect(
            screenX,
            screenY + scaledTile - 2 * camera.zoom,
            scaledTile + 1,
            2 * camera.zoom
          );
          // Brick lines
          ctx.strokeStyle = "rgba(0,0,0,0.15)";
          ctx.lineWidth = 1;
          const mid = screenY + scaledTile / 2;
          ctx.beginPath();
          ctx.moveTo(screenX, mid);
          ctx.lineTo(screenX + scaledTile, mid);
          ctx.stroke();
          if ((x + y) % 2 === 0) {
            ctx.beginPath();
            ctx.moveTo(screenX + scaledTile / 2, screenY);
            ctx.lineTo(screenX + scaledTile / 2, mid);
            ctx.stroke();
          }
        }

        // Subtle grid lines for floors
        if (tile.type === "floor" || tile.type === "floor_alt") {
          ctx.strokeStyle = "rgba(255,255,255,0.02)";
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX, screenY, scaledTile, scaledTile);
        }
      }
    }
  }
}
