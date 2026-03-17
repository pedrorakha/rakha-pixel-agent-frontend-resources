import {
  TILE_SIZE,
  COLORS,
  STATUS_COLORS,
  COFFEE_AREA,
  BED_AREA,
  CHARACTER_WIDTH,
  CHARACTER_HEIGHT,
  DESK_WIDTH,
  DESK_HEIGHT,
  ANIMATION_SPEEDS,
  ROOM_FURNITURE,
  ROOMS,
} from "@/lib/constants";
import { Character, CharacterState, AccessoryHat, AccessoryGlasses } from "@/types/character";
import { Desk } from "@/types/office";
import { DiscordStatus } from "@/types/discord";
import { GameState } from "./types";
import { Tilemap } from "./tilemap";

export class Renderer {
  private tilemap: Tilemap;
  private ctx: CanvasRenderingContext2D | null = null;
  // Per-character color overrides (set before drawing each character)
  private skinColor: string = COLORS.skin;
  private hairColor: string = COLORS.hair;

  constructor(tilemap: Tilemap) {
    this.tilemap = tilemap;
  }

  setContext(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
  }

  render(
    state: GameState,
    desks: Desk[],
    characters: Character[],
    presenceMap: Map<string, DiscordStatus>
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

    // Disable image smoothing for pixel-perfect rendering
    ctx.imageSmoothingEnabled = false;

    // Layer 1: Floor tiles
    this.tilemap.render(ctx, state);

    // Layer 2: Room furniture (beds, coffee corners, plants, rugs, bookshelves)
    for (const rf of ROOM_FURNITURE) {
      this.renderRoomFurniture(ctx, state, rf);
    }

    // Layer 3: Desks (bigger 3x2)
    for (const desk of desks) {
      this.renderDesk(ctx, state, desk);
    }

    // Layer 4: Characters (sorted by Y for overlap)
    const sortedChars = [...characters].sort((a, b) => a.gridY - b.gridY);
    for (const char of sortedChars) {
      const status = presenceMap.get(char.discordId) ?? "offline";
      this.renderCharacter(ctx, state, char, status);
    }
  }

  private worldToScreen(
    state: GameState,
    worldX: number,
    worldY: number
  ): { x: number; y: number } {
    return {
      x: (worldX - state.camera.x) * state.camera.zoom,
      y: (worldY - state.camera.y) * state.camera.zoom,
    };
  }

  private renderDesk(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    desk: Desk
  ): void {
    const px = desk.gridX * TILE_SIZE;
    const py = desk.gridY * TILE_SIZE;
    const { x, y } = this.worldToScreen(state, px, py);
    const zoom = state.camera.zoom;
    const dw = DESK_WIDTH * TILE_SIZE * zoom;
    const dh = DESK_HEIGHT * TILE_SIZE * zoom;

    // Desk surface
    ctx.fillStyle = COLORS.desk;
    ctx.fillRect(x, y, dw, dh);

    // Desk top highlight
    ctx.fillStyle = COLORS.deskLight;
    ctx.fillRect(x + 1 * zoom, y + 1 * zoom, dw - 2 * zoom, 2 * zoom);

    // Desk shadow
    ctx.fillStyle = COLORS.deskDark;
    ctx.fillRect(x, y + dh - 2 * zoom, dw, 2 * zoom);

    // Monitor
    const monW = 10 * zoom;
    const monH = 8 * zoom;
    const monX = x + (dw - monW) / 2;
    const monY = y - monH + 2 * zoom;

    // Monitor body
    ctx.fillStyle = COLORS.monitor;
    ctx.fillRect(monX, monY, monW, monH);

    // Monitor screen
    ctx.fillStyle = COLORS.monitorScreenOn;
    ctx.fillRect(
      monX + 1 * zoom,
      monY + 1 * zoom,
      monW - 2 * zoom,
      monH - 3 * zoom
    );

    // Monitor stand
    ctx.fillStyle = COLORS.monitor;
    ctx.fillRect(
      monX + monW / 2 - 1 * zoom,
      monY + monH,
      2 * zoom,
      2 * zoom
    );

    // Desk label
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${Math.max(6, 6 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText(desk.label, x + dw / 2, y + dh + 8 * zoom);
    ctx.textAlign = "start";

    // Keyboard in front of monitor
    const kbW = 8 * zoom;
    const kbH = 3 * zoom;
    ctx.fillStyle = COLORS.keyboard ?? "#2a2a2a";
    ctx.fillRect(x + (dw - kbW) / 2, y + dh - 6 * zoom, kbW, kbH);
  }

  private renderRoomFurniture(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    rf: (typeof ROOM_FURNITURE)[number]
  ): void {
    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;

    // --- Rug ---
    {
      const { x: rx, y: ry, w: rw, h: rh } = rf.rug;
      const { x: sx, y: sy } = this.worldToScreen(state, rx * TILE_SIZE, ry * TILE_SIZE);
      const rugW = rw * ts;
      const rugH = rh * ts;
      ctx.fillStyle = COLORS.rug ?? "#4a3060";
      ctx.fillRect(sx, sy, rugW, rugH);
      ctx.strokeStyle = COLORS.rugBorder ?? "#5a4070";
      ctx.lineWidth = 2 * zoom;
      ctx.strokeRect(sx + zoom, sy + zoom, rugW - 2 * zoom, rugH - 2 * zoom);
    }

    // --- Bed ---
    {
      const { x: bx, y: by } = rf.bed;
      const { x: sx, y: sy } = this.worldToScreen(state, bx * TILE_SIZE, by * TILE_SIZE);
      const bedW = 3 * ts;
      const bedH = 2 * ts;

      // Frame
      ctx.fillStyle = COLORS.bed;
      ctx.fillRect(sx, sy, bedW, bedH);
      // Mattress
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(sx + 2 * zoom, sy + 2 * zoom, bedW - 4 * zoom, bedH - 4 * zoom);
      // Sheet
      ctx.fillStyle = COLORS.bedSheet;
      ctx.fillRect(sx + 2 * zoom, sy + 4 * zoom, bedW - 4 * zoom, bedH - 6 * zoom);
      // Sheet stripe
      ctx.fillStyle = COLORS.bedSheetDark ?? "#8bc4d6";
      ctx.fillRect(sx + 2 * zoom, sy + bedH / 2, bedW - 4 * zoom, 2 * zoom);
      // Pillow
      ctx.fillStyle = COLORS.bedPillow;
      ctx.fillRect(sx + bedW - 12 * zoom, sy + 4 * zoom, 10 * zoom, bedH - 8 * zoom);
      ctx.fillStyle = COLORS.bedPillowShadow ?? "#ddd";
      ctx.fillRect(sx + bedW - 12 * zoom, sy + bedH / 2 - zoom, 10 * zoom, 2 * zoom);
    }

    // --- Coffee corner (small table + mug) ---
    {
      const { x: cx, y: cy } = rf.coffee;
      const { x: sx, y: sy } = this.worldToScreen(state, cx * TILE_SIZE, cy * TILE_SIZE);

      // Small table
      ctx.fillStyle = COLORS.coffeeTable ?? "#5c3d2e";
      ctx.fillRect(sx, sy, 2 * ts, ts);
      ctx.fillStyle = COLORS.bed; // darker edge
      ctx.fillRect(sx, sy + ts - 2 * zoom, 2 * ts, 2 * zoom);

      // Coffee machine
      ctx.fillStyle = COLORS.coffeeMachine;
      ctx.fillRect(sx + 2 * zoom, sy + 2 * zoom, 8 * zoom, 10 * zoom);
      // Machine screen
      ctx.fillStyle = "#00cc44";
      ctx.fillRect(sx + 4 * zoom, sy + 4 * zoom, 4 * zoom, 3 * zoom);

      // Mug
      ctx.fillStyle = COLORS.mug ?? "#fff";
      ctx.fillRect(sx + ts + 4 * zoom, sy + 3 * zoom, 6 * zoom, 7 * zoom);
      ctx.fillStyle = COLORS.coffeeCup;
      ctx.fillRect(sx + ts + 5 * zoom, sy + 5 * zoom, 4 * zoom, 4 * zoom);
    }

    // --- Plant ---
    {
      const { x: px, y: py } = rf.plant;
      const { x: sx, y: sy } = this.worldToScreen(state, px * TILE_SIZE, py * TILE_SIZE);

      // Pot
      ctx.fillStyle = COLORS.plantPot;
      ctx.fillRect(sx + 3 * zoom, sy + 8 * zoom, 10 * zoom, 6 * zoom);
      // Plant leaves
      ctx.fillStyle = COLORS.plant;
      ctx.fillRect(sx + 4 * zoom, sy + 2 * zoom, 4 * zoom, 6 * zoom);
      ctx.fillRect(sx + 8 * zoom, sy + 3 * zoom, 4 * zoom, 5 * zoom);
      ctx.fillStyle = COLORS.plantDark ?? "#27ae60";
      ctx.fillRect(sx + 5 * zoom, sy + 4 * zoom, 3 * zoom, 3 * zoom);
    }

    // --- Bookshelf ---
    {
      const { x: bx, y: by } = rf.bookshelf;
      const { x: sx, y: sy } = this.worldToScreen(state, bx * TILE_SIZE, by * TILE_SIZE);
      const shelfW = ts;
      const shelfH = 2 * ts;

      // Shelf frame
      ctx.fillStyle = COLORS.bookshelf ?? "#6b4513";
      ctx.fillRect(sx, sy, shelfW, shelfH);

      // Books (colored spines)
      const bookColors = COLORS.bookColors ?? ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f"];
      const bookW = 3 * zoom;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = bookColors[i % bookColors.length];
        ctx.fillRect(sx + 2 * zoom + i * bookW, sy + 2 * zoom, bookW - zoom, shelfH / 2 - 3 * zoom);
        ctx.fillRect(sx + 2 * zoom + i * bookW, sy + shelfH / 2 + zoom, bookW - zoom, shelfH / 2 - 3 * zoom);
      }

      // Shelf divider
      ctx.fillStyle = COLORS.bookshelf ?? "#6b4513";
      ctx.fillRect(sx, sy + shelfH / 2 - zoom, shelfW, 2 * zoom);
    }

    // --- Room label ---
    {
      const room = ROOMS[rf.roomIndex];
      const { x: sx, y: sy } = this.worldToScreen(
        state,
        (room.x + room.w / 2) * TILE_SIZE,
        (room.y + room.h - 1) * TILE_SIZE
      );
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.fillText(room.label, sx, sy);
      ctx.textAlign = "start";
    }
  }

  private renderCharacter(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    character: Character,
    status: DiscordStatus
  ): void {
    const px = character.gridX * TILE_SIZE;
    const py = character.gridY * TILE_SIZE;
    const { x, y } = this.worldToScreen(state, px, py);
    const zoom = state.camera.zoom;

    const cw = CHARACTER_WIDTH * zoom;
    const ch = CHARACTER_HEIGHT * zoom;
    const cx = x + (TILE_SIZE * zoom - cw) / 2;
    const cy = y + (TILE_SIZE * zoom - ch);

    const animFrame = character.animationFrame;
    const charState = character.state;

    // Set per-character color overrides
    this.skinColor = character.colorSkin || COLORS.skin;
    this.hairColor = character.colorHair || COLORS.hair;

    // Draw character based on state
    switch (charState) {
      case "typing":
        this.drawTypingCharacter(ctx, cx, cy, cw, ch, zoom, character.color, animFrame);
        break;
      case "focused":
        this.drawFocusedCharacter(ctx, cx, cy, cw, ch, zoom, character.color, animFrame);
        break;
      case "drinking_coffee":
        this.drawCoffeeCharacter(ctx, cx, cy, cw, ch, zoom, character.color, animFrame, state.time);
        break;
      case "sleeping":
        this.drawSleepingCharacter(ctx, cx, cy, cw, ch, zoom, character.color, animFrame, state.time);
        break;
      case "walking":
        this.drawWalkingCharacter(ctx, cx, cy, cw, ch, zoom, character.color, animFrame);
        break;
      case "idle":
        this.drawIdleCharacter(ctx, cx, cy, cw, ch, zoom, character.color, animFrame);
        break;
    }

    // Accessories — draw on top of character
    const headSize = cw * 0.6;
    const headX = cx + (cw - headSize) / 2;

    // Hat (on top of head)
    if (character.hat && character.hat !== "none" && charState !== "sleeping") {
      this.drawHat(ctx, headX, cy, headSize, zoom, character.hat);
    }

    // Glasses (on face)
    if (character.glasses && character.glasses !== "none" && charState !== "sleeping") {
      this.drawGlasses(ctx, headX, cy, headSize, zoom, character.glasses);
    }

    // Name label
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    const nameY = character.hat && character.hat !== "none" && charState !== "sleeping" ? cy - 10 * zoom : cy - 6 * zoom;
    ctx.fillText(character.name, cx + cw / 2, nameY);
    ctx.textAlign = "start";

    // Status dot
    const dotSize = 3 * zoom;
    ctx.fillStyle = STATUS_COLORS[status];
    ctx.beginPath();
    ctx.arc(cx + cw + 2 * zoom, cy + 2 * zoom, dotSize, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHat(
    ctx: CanvasRenderingContext2D,
    headX: number, headY: number, headSize: number,
    zoom: number, hat: AccessoryHat
  ): void {
    switch (hat) {
      case "cap": {
        // Baseball cap
        ctx.fillStyle = "#c0392b";
        ctx.fillRect(headX - 1 * zoom, headY - 3 * zoom, headSize + 2 * zoom, 4 * zoom);
        // Brim
        ctx.fillStyle = "#a93226";
        ctx.fillRect(headX - 2 * zoom, headY, headSize * 0.7, 2 * zoom);
        break;
      }
      case "beanie": {
        // Beanie hat
        ctx.fillStyle = "#8e44ad";
        ctx.fillRect(headX - 1 * zoom, headY - 4 * zoom, headSize + 2 * zoom, 5 * zoom);
        // Folded brim
        ctx.fillStyle = "#7d3c98";
        ctx.fillRect(headX - 1 * zoom, headY - 1 * zoom, headSize + 2 * zoom, 2 * zoom);
        // Pompom
        ctx.fillStyle = "#f1c40f";
        ctx.fillRect(headX + headSize / 2 - 1.5 * zoom, headY - 6 * zoom, 3 * zoom, 3 * zoom);
        break;
      }
      case "tophat": {
        // Top hat
        ctx.fillStyle = "#1a1a2e";
        // Brim
        ctx.fillRect(headX - 2 * zoom, headY - 2 * zoom, headSize + 4 * zoom, 2 * zoom);
        // Tall part
        ctx.fillRect(headX, headY - 8 * zoom, headSize, 7 * zoom);
        // Band
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(headX, headY - 4 * zoom, headSize, 1.5 * zoom);
        break;
      }
      case "crown": {
        // Crown
        ctx.fillStyle = "#f1c40f";
        ctx.fillRect(headX - 1 * zoom, headY - 2 * zoom, headSize + 2 * zoom, 3 * zoom);
        // Points
        ctx.fillRect(headX, headY - 5 * zoom, 2 * zoom, 3 * zoom);
        ctx.fillRect(headX + headSize / 2 - 1 * zoom, headY - 6 * zoom, 2 * zoom, 4 * zoom);
        ctx.fillRect(headX + headSize - 2 * zoom, headY - 5 * zoom, 2 * zoom, 3 * zoom);
        // Gems
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(headX + headSize / 2 - 0.5 * zoom, headY - 1 * zoom, 1.5 * zoom, 1.5 * zoom);
        break;
      }
      case "headband": {
        // Headband / sweatband
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(headX - 1 * zoom, headY + 1 * zoom, headSize + 2 * zoom, 2 * zoom);
        break;
      }
    }
  }

  private drawGlasses(
    ctx: CanvasRenderingContext2D,
    headX: number, headY: number, headSize: number,
    zoom: number, glasses: AccessoryGlasses
  ): void {
    const eyeY = headY + 3.5 * zoom;

    switch (glasses) {
      case "round": {
        // Round glasses
        ctx.strokeStyle = "#333333";
        ctx.lineWidth = zoom * 0.8;
        // Left lens
        ctx.beginPath();
        ctx.arc(headX + 2.5 * zoom, eyeY + 1 * zoom, 2 * zoom, 0, Math.PI * 2);
        ctx.stroke();
        // Right lens
        ctx.beginPath();
        ctx.arc(headX + headSize - 2.5 * zoom, eyeY + 1 * zoom, 2 * zoom, 0, Math.PI * 2);
        ctx.stroke();
        // Bridge
        ctx.beginPath();
        ctx.moveTo(headX + 4.5 * zoom, eyeY + 1 * zoom);
        ctx.lineTo(headX + headSize - 4.5 * zoom, eyeY + 1 * zoom);
        ctx.stroke();
        break;
      }
      case "square": {
        // Square/rectangular glasses
        ctx.strokeStyle = "#1a1a2e";
        ctx.lineWidth = zoom * 0.8;
        // Left lens
        ctx.strokeRect(headX + 0.5 * zoom, eyeY - 0.5 * zoom, 3.5 * zoom, 3 * zoom);
        // Right lens
        ctx.strokeRect(headX + headSize - 4 * zoom, eyeY - 0.5 * zoom, 3.5 * zoom, 3 * zoom);
        // Bridge
        ctx.beginPath();
        ctx.moveTo(headX + 4 * zoom, eyeY + 1 * zoom);
        ctx.lineTo(headX + headSize - 4 * zoom, eyeY + 1 * zoom);
        ctx.stroke();
        break;
      }
      case "sunglasses": {
        // Sunglasses — filled dark lenses
        ctx.fillStyle = "#1a1a2e";
        // Left lens
        ctx.fillRect(headX + 0.5 * zoom, eyeY - 0.5 * zoom, 3.5 * zoom, 3 * zoom);
        // Right lens
        ctx.fillRect(headX + headSize - 4 * zoom, eyeY - 0.5 * zoom, 3.5 * zoom, 3 * zoom);
        // Bridge
        ctx.fillRect(headX + 4 * zoom, eyeY + 0.5 * zoom, headSize - 8 * zoom, 1 * zoom);
        // Shine
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(headX + 1 * zoom, eyeY, 1 * zoom, 1 * zoom);
        ctx.fillRect(headX + headSize - 3.5 * zoom, eyeY, 1 * zoom, 1 * zoom);
        break;
      }
      case "monocle": {
        // Monocle — only right eye
        ctx.strokeStyle = "#c0a030";
        ctx.lineWidth = zoom * 0.8;
        ctx.beginPath();
        ctx.arc(headX + headSize - 2.5 * zoom, eyeY + 1 * zoom, 2.5 * zoom, 0, Math.PI * 2);
        ctx.stroke();
        // Chain
        ctx.strokeStyle = "#c0a030";
        ctx.lineWidth = zoom * 0.5;
        ctx.beginPath();
        ctx.moveTo(headX + headSize - 0.5 * zoom, eyeY + 3 * zoom);
        ctx.lineTo(headX + headSize + 1 * zoom, eyeY + 7 * zoom);
        ctx.stroke();
        break;
      }
    }
  }

  private drawPixelBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom: number,
    shirtColor: string
  ): void {
    // Head
    ctx.fillStyle = this.skinColor;
    const headSize = w * 0.6;
    const headX = x + (w - headSize) / 2;
    ctx.fillRect(headX, y, headSize, headSize);

    // Hair
    ctx.fillStyle = this.hairColor;
    ctx.fillRect(headX, y, headSize, 3 * zoom);

    // Eyes
    ctx.fillStyle = "#000000";
    ctx.fillRect(headX + 2 * zoom, y + 4 * zoom, 1.5 * zoom, 1.5 * zoom);
    ctx.fillRect(
      headX + headSize - 3.5 * zoom,
      y + 4 * zoom,
      1.5 * zoom,
      1.5 * zoom
    );

    // Body / shirt
    const bodyY = y + headSize + 1 * zoom;
    const bodyH = h * 0.35;
    ctx.fillStyle = shirtColor;
    ctx.fillRect(x + 1 * zoom, bodyY, w - 2 * zoom, bodyH);

    // Pants
    ctx.fillStyle = COLORS.pants;
    const pantsY = bodyY + bodyH;
    ctx.fillRect(x + 1 * zoom, pantsY, w - 2 * zoom, h * 0.2);
  }

  private drawTypingCharacter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom: number,
    color: string,
    frame: number
  ): void {
    this.drawPixelBody(ctx, x, y, w, h, zoom, color);

    // Arms typing animation - alternate arm positions
    const armOffset = frame % 2 === 0 ? 0 : -1 * zoom;
    ctx.fillStyle = this.skinColor;
    // Left arm
    ctx.fillRect(x - 1 * zoom, y + h * 0.45 + armOffset, 2 * zoom, 4 * zoom);
    // Right arm
    ctx.fillRect(
      x + w - 1 * zoom,
      y + h * 0.45 - armOffset,
      2 * zoom,
      4 * zoom
    );
  }

  private drawFocusedCharacter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom: number,
    color: string,
    _frame: number
  ): void {
    this.drawPixelBody(ctx, x, y, w, h, zoom, color);

    // Headphones
    const headSize = w * 0.6;
    const headX = x + (w - headSize) / 2;

    ctx.fillStyle = COLORS.headphones;
    // Headband
    ctx.fillRect(headX - 1 * zoom, y - 1 * zoom, headSize + 2 * zoom, 2 * zoom);
    // Left ear cup
    ctx.fillStyle = COLORS.headphonesAccent;
    ctx.fillRect(headX - 2 * zoom, y + 2 * zoom, 3 * zoom, 4 * zoom);
    // Right ear cup
    ctx.fillRect(
      headX + headSize - 1 * zoom,
      y + 2 * zoom,
      3 * zoom,
      4 * zoom
    );

    // Arms resting on desk
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(x - 1 * zoom, y + h * 0.5, 2 * zoom, 3 * zoom);
    ctx.fillRect(x + w - 1 * zoom, y + h * 0.5, 2 * zoom, 3 * zoom);
  }

  private drawCoffeeCharacter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom: number,
    color: string,
    frame: number,
    time: number
  ): void {
    // Slight bounce when drinking
    const bounce = frame % 2 === 0 ? 0 : -1 * zoom;
    this.drawPixelBody(ctx, x, y + bounce, w, h, zoom, color);

    // Coffee cup in right hand
    const cupX = x + w;
    const cupY = y + h * 0.4 + bounce;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cupX, cupY, 4 * zoom, 5 * zoom);
    ctx.fillStyle = COLORS.coffeeCup;
    ctx.fillRect(cupX + 0.5 * zoom, cupY + 1 * zoom, 3 * zoom, 3.5 * zoom);

    // Steam
    ctx.fillStyle = COLORS.steam;
    ctx.globalAlpha = 0.5;
    const steamOffset = Math.floor(time * 2) % 3;
    ctx.fillRect(
      cupX + 1 * zoom,
      cupY - (2 + steamOffset) * zoom,
      1 * zoom,
      1 * zoom
    );
    ctx.fillRect(
      cupX + 2.5 * zoom,
      cupY - (3 + steamOffset) * zoom,
      1 * zoom,
      1 * zoom
    );
    ctx.globalAlpha = 1;

    // Left arm at side
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(x - 1 * zoom, y + h * 0.45 + bounce, 2 * zoom, 4 * zoom);
  }

  private drawSleepingCharacter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    _h: number,
    zoom: number,
    color: string,
    _frame: number,
    time: number
  ): void {
    // Lying down - draw horizontal
    const lw = _h;
    const lh = w * 0.7;

    // Blanket
    ctx.fillStyle = COLORS.bedSheet;
    ctx.fillRect(x, y + lh * 0.3, lw * 0.7, lh * 0.7);

    // Head on pillow
    ctx.fillStyle = COLORS.bedPillow;
    ctx.fillRect(x + lw * 0.7, y + lh * 0.2, lw * 0.3, lh * 0.4);

    // Face
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(x + lw * 0.72, y + lh * 0.25, lw * 0.2, lh * 0.35);

    // Closed eyes (lines)
    ctx.fillStyle = "#000000";
    ctx.fillRect(x + lw * 0.76, y + lh * 0.38, 2 * zoom, 1 * zoom);
    ctx.fillRect(x + lw * 0.82, y + lh * 0.38, 2 * zoom, 1 * zoom);

    // Hair
    ctx.fillStyle = this.hairColor;
    ctx.fillRect(x + lw * 0.72, y + lh * 0.22, lw * 0.2, 2 * zoom);

    // Body under blanket hint
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x + lw * 0.1, y + lh * 0.35, lw * 0.6, lh * 0.3);
    ctx.globalAlpha = 1;

    // Zzz animation
    const zzzOffset = Math.floor(time * 1.5) % 3;
    ctx.fillStyle = COLORS.zzz;
    ctx.font = `${Math.max(6, 6 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    const zx = x + lw * 0.85;
    ctx.globalAlpha = 0.8 - zzzOffset * 0.2;
    ctx.fillText("z", zx, y - (2 + zzzOffset * 4) * zoom);
    if (zzzOffset > 0) {
      ctx.globalAlpha = 0.6;
      ctx.fillText("z", zx + 3 * zoom, y - (6 + zzzOffset * 3) * zoom);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
  }

  private drawWalkingCharacter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom: number,
    color: string,
    frame: number
  ): void {
    const bounce = frame % 2 === 0 ? 0 : -1 * zoom;
    this.drawPixelBody(ctx, x, y + bounce, w, h, zoom, color);

    // Legs animation
    const legSwing = frame % 2 === 0 ? 1 : -1;
    ctx.fillStyle = COLORS.pants;
    ctx.fillRect(
      x + 2 * zoom + legSwing * zoom,
      y + h * 0.75 + bounce,
      3 * zoom,
      h * 0.25
    );
    ctx.fillRect(
      x + w - 5 * zoom - legSwing * zoom,
      y + h * 0.75 + bounce,
      3 * zoom,
      h * 0.25
    );

    // Swinging arms
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(
      x - 1 * zoom,
      y + h * 0.4 + legSwing * 2 * zoom + bounce,
      2 * zoom,
      4 * zoom
    );
    ctx.fillRect(
      x + w - 1 * zoom,
      y + h * 0.4 - legSwing * 2 * zoom + bounce,
      2 * zoom,
      4 * zoom
    );
  }

  private drawIdleCharacter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom: number,
    color: string,
    _frame: number
  ): void {
    this.drawPixelBody(ctx, x, y, w, h, zoom, color);

    // Arms at sides
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(x - 1 * zoom, y + h * 0.4, 2 * zoom, 5 * zoom);
    ctx.fillRect(x + w - 1 * zoom, y + h * 0.4, 2 * zoom, 5 * zoom);
  }

  private renderCoffeeArea(
    ctx: CanvasRenderingContext2D,
    state: GameState
  ): void {
    const { x: sx, y: sy } = this.worldToScreen(
      state,
      COFFEE_AREA.x * TILE_SIZE,
      COFFEE_AREA.y * TILE_SIZE
    );
    const zoom = state.camera.zoom;
    const aw = COFFEE_AREA.width * TILE_SIZE * zoom;
    const ah = COFFEE_AREA.height * TILE_SIZE * zoom;

    // Coffee area floor (warmer tone)
    ctx.fillStyle = "#3d2b1f";
    ctx.fillRect(sx, sy, aw, ah);

    // Counter / table
    ctx.fillStyle = "#5c3d2e";
    ctx.fillRect(sx + 4 * zoom, sy + 4 * zoom, aw - 8 * zoom, 12 * zoom);

    // Coffee machine
    ctx.fillStyle = COLORS.coffeeMachine;
    ctx.fillRect(sx + 8 * zoom, sy + 2 * zoom, 12 * zoom, 12 * zoom);
    // Machine screen
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(sx + 10 * zoom, sy + 4 * zoom, 4 * zoom, 3 * zoom);
    // Drip area
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(sx + 16 * zoom, sy + 8 * zoom, 3 * zoom, 6 * zoom);

    // Plant decoration
    ctx.fillStyle = COLORS.plantPot;
    ctx.fillRect(sx + aw - 16 * zoom, sy + 4 * zoom, 8 * zoom, 6 * zoom);
    ctx.fillStyle = COLORS.plant;
    ctx.fillRect(sx + aw - 14 * zoom, sy - 2 * zoom, 4 * zoom, 6 * zoom);
    ctx.fillRect(sx + aw - 10 * zoom, sy, 2 * zoom, 4 * zoom);

    // "COFFEE" label
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("COFFEE", sx + aw / 2, sy + ah - 4 * zoom);
    ctx.textAlign = "start";
  }

  private renderBedArea(
    ctx: CanvasRenderingContext2D,
    state: GameState
  ): void {
    const { x: sx, y: sy } = this.worldToScreen(
      state,
      BED_AREA.x * TILE_SIZE,
      BED_AREA.y * TILE_SIZE
    );
    const zoom = state.camera.zoom;
    const aw = BED_AREA.width * TILE_SIZE * zoom;
    const ah = BED_AREA.height * TILE_SIZE * zoom;

    // Bed area floor (darker)
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(sx, sy, aw, ah);

    // Beds
    for (let i = 0; i < 3; i++) {
      const bedX = sx + 6 * zoom;
      const bedY = sy + (4 + i * 28) * zoom;
      const bedW = aw - 12 * zoom;
      const bedH = 22 * zoom;

      // Bed frame
      ctx.fillStyle = COLORS.bed;
      ctx.fillRect(bedX, bedY, bedW, bedH);

      // Mattress
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(bedX + 2 * zoom, bedY + 2 * zoom, bedW - 4 * zoom, bedH - 4 * zoom);

      // Sheet
      ctx.fillStyle = COLORS.bedSheet;
      ctx.fillRect(
        bedX + 2 * zoom,
        bedY + 6 * zoom,
        bedW - 4 * zoom,
        bedH - 8 * zoom
      );

      // Pillow
      ctx.fillStyle = COLORS.bedPillow;
      ctx.fillRect(
        bedX + bedW - 14 * zoom,
        bedY + 4 * zoom,
        10 * zoom,
        bedH - 8 * zoom
      );
    }

    // "REST" label
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("REST", sx + aw / 2, sy + ah - 4 * zoom);
    ctx.textAlign = "start";
  }
}

export function updateCharacterAnimations(
  characters: Character[],
  deltaTime: number
): Character[] {
  return characters.map((char) => {
    const speed = ANIMATION_SPEEDS[char.state];
    const newTimer = char.animationTimer + deltaTime * 1000;

    if (newTimer >= speed) {
      const maxFrames = char.state === "sleeping" ? 2 : 4;
      return {
        ...char,
        animationTimer: 0,
        animationFrame: (char.animationFrame + 1) % maxFrames,
      };
    }

    return { ...char, animationTimer: newTimer };
  });
}
