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
  MEETING_ROOM_INDEX,
  CAFE_ROOM_INDEX,
  ROOM_DOORS,
  GARDEN,
  DOG_POSITION,
} from "@/lib/constants";
import { Character, CharacterState, AccessoryHat, AccessoryGlasses, HairStyle } from "@/types/character";
import { Desk } from "@/types/office";
import { DiscordStatus } from "@/types/discord";
import { GameState } from "./types";
import { Tilemap } from "./tilemap";
import { ChatBubble } from "@/stores/chat-store";
import { FloatingReaction } from "@/stores/reaction-store";
import { Footprint } from "@/stores/footprint-store";

export class Renderer {
  private tilemap: Tilemap;
  private ctx: CanvasRenderingContext2D | null = null;
  // Per-character color overrides (set before drawing each character)
  private skinColor: string = COLORS.skin;
  private hairColor: string = COLORS.hair;
  private currentHairStyle: HairStyle = "short";
  private currentDirection: "up" | "down" | "left" | "right" = "down";

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
    presenceMap: Map<string, DiscordStatus>,
    localPlayerId?: string | null,
    chatBubbles?: ChatBubble[],
    onlinePlayers?: Set<string>,
    reactions?: FloatingReaction[],
    footprints?: Footprint[],
    lockedDoors?: Set<number>,
    playerNearDoorRoom?: number,
    dogPetFrame?: number
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

    // Layer 1.5: Footprints
    if (footprints && footprints.length > 0) {
      this.renderFootprints(ctx, state, footprints);
    }

    // Layer 2: Room furniture (beds, coffee corners, plants, rugs, bookshelves)
    for (const rf of ROOM_FURNITURE) {
      // Procura desk do banco para este room e usa o label dele
      const deskForRoom = desks.find(
        (d) => d.gridX === rf.desk.x && d.gridY === rf.desk.y
      );
      this.renderRoomFurniture(ctx, state, rf, deskForRoom?.label);
    }

    // Layer 2.5: Meeting room furniture
    this.renderMeetingRoom(ctx, state);

    // Layer 2.6: Café room furniture
    this.renderCafeRoom(ctx, state);

    // Layer 2.7: Garden decorations
    this.renderGarden(ctx, state);

    // Layer 2.8: Dog
    this.renderDog(ctx, state, dogPetFrame ?? -1);

    // Layer 2.9: Door overlays (todas as rooms)
    if (lockedDoors) {
      Array.from(lockedDoors).forEach((roomIdx) => {
        this.renderLockedDoor(ctx, state, roomIdx);
      });
    }
    if (playerNearDoorRoom !== undefined && playerNearDoorRoom >= 0) {
      this.renderDoorHighlight(ctx, state, playerNearDoorRoom, lockedDoors?.has(playerNearDoorRoom) ?? false);
    }

    // Layer 3: Desks (bigger 3x2)
    for (const desk of desks) {
      this.renderDesk(ctx, state, desk);
    }

    // Layer 4: Characters (sorted by Y for overlap)
    const sortedChars = [...characters].sort((a, b) => a.gridY - b.gridY);
    for (const char of sortedChars) {
      const status = presenceMap.get(char.discordId) ?? "offline";
      const isLocalPlayer = char.id === localPlayerId;
      const isRemoteOnline = !isLocalPlayer && onlinePlayers?.has(char.id);

      // Indicador visual — vermelho para local, cinza para outros online
      if (isLocalPlayer) {
        this.renderPlayerIndicator(ctx, state, char, "#e94560", "rgba(233, 69, 96, 0.25)");
      } else if (isRemoteOnline) {
        this.renderPlayerIndicator(ctx, state, char, "#95a5a6", "rgba(149, 165, 166, 0.2)");
      }

      this.renderCharacter(ctx, state, char, status);
    }

    // Layer 5: Chat bubbles (acima de tudo)
    if (chatBubbles && chatBubbles.length > 0) {
      // Agrupa bolhas por memberId (mostra apenas a mais recente por personagem)
      const latestByMember = new Map<string, ChatBubble>();
      for (const bubble of chatBubbles) {
        const existing = latestByMember.get(bubble.memberId);
        if (!existing || bubble.timestamp > existing.timestamp) {
          latestByMember.set(bubble.memberId, bubble);
        }
      }

      latestByMember.forEach((bubble) => {
        const char = characters.find((c) => c.id === bubble.memberId);
        if (!char) return;
        this.renderChatBubble(ctx, state, char, bubble);
      });
    }

    // Layer 6: Floating reactions
    if (reactions && reactions.length > 0) {
      for (const reaction of reactions) {
        const char = characters.find((c) => c.id === reaction.memberId);
        if (!char) continue;
        this.renderReaction(ctx, state, char, reaction);
      }
    }

    // Layer 7: Day/night overlay
    this.renderDayNightOverlay(ctx, state);
  }

  private renderPlayerIndicator(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    character: Character,
    arrowColor: string,
    shadowColor: string
  ): void {
    const px = character.gridX * TILE_SIZE;
    const py = character.gridY * TILE_SIZE;
    const { x, y } = this.worldToScreen(state, px, py);
    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;

    // Sombra circular sob o personagem
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.ellipse(
      x + ts / 2,
      y + ts - 2 * zoom,
      ts * 0.45,
      ts * 0.2,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Seta pulsante acima do personagem
    const pulse = Math.sin(state.time * 4) * 2 * zoom;
    const arrowX = x + ts / 2;
    const arrowY = y - 14 * zoom + pulse;
    const arrowSize = 3 * zoom;

    ctx.fillStyle = arrowColor;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY + arrowSize);
    ctx.lineTo(arrowX - arrowSize, arrowY);
    ctx.lineTo(arrowX + arrowSize, arrowY);
    ctx.closePath();
    ctx.fill();
  }

  private renderFootprints(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    footprints: Footprint[]
  ): void {
    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;

    for (const fp of footprints) {
      const { x, y } = this.worldToScreen(state, fp.gridX * TILE_SIZE, fp.gridY * TILE_SIZE);
      ctx.globalAlpha = fp.opacity;
      ctx.fillStyle = "rgba(200, 200, 200, 0.6)";
      // Pegada esquerda
      ctx.fillRect(x + ts * 0.2, y + ts * 0.5, 2 * zoom, 3 * zoom);
      ctx.fillRect(x + ts * 0.2, y + ts * 0.45, 1.5 * zoom, 1.5 * zoom);
      // Pegada direita
      ctx.fillRect(x + ts * 0.55, y + ts * 0.6, 2 * zoom, 3 * zoom);
      ctx.fillRect(x + ts * 0.55, y + ts * 0.55, 1.5 * zoom, 1.5 * zoom);
    }
    ctx.globalAlpha = 1;
  }

  private renderReaction(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    character: Character,
    reaction: FloatingReaction
  ): void {
    const px = character.gridX * TILE_SIZE;
    const py = character.gridY * TILE_SIZE;
    const { x, y } = this.worldToScreen(state, px, py);
    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;

    ctx.globalAlpha = reaction.opacity;
    ctx.font = `${Math.max(12, 12 * zoom)}px "Press Start 2P", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      reaction.emoji,
      x + ts / 2,
      y - 10 * zoom - reaction.offsetY * zoom
    );
    ctx.textAlign = "start";
    ctx.globalAlpha = 1;
  }

  private renderDayNightOverlay(
    ctx: CanvasRenderingContext2D,
    state: GameState
  ): void {
    const hour = new Date().getHours();

    // Calcula intensidade: escurece entre 19h-6h
    let darkness = 0;
    if (hour >= 20) darkness = Math.min((hour - 20) * 0.07, 0.3);
    else if (hour >= 19) darkness = (hour - 19) * 0.05;
    else if (hour < 5) darkness = 0.3;
    else if (hour < 7) darkness = 0.3 - (hour - 5) * 0.15;

    if (darkness <= 0) return;

    // Overlay azul escuro semi-transparente
    ctx.fillStyle = `rgba(10, 10, 40, ${darkness})`;
    ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
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
    const z = state.camera.zoom;
    const dw = DESK_WIDTH * TILE_SIZE * z;
    const dh = DESK_HEIGHT * TILE_SIZE * z;

    // Sombra da mesa
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(x + z, y + dh, dw, 2 * z);

    // Mesa — superficie com borda arredondada
    ctx.fillStyle = COLORS.desk;
    ctx.fillRect(x + z, y, dw - 2 * z, dh);
    ctx.fillRect(x, y + z, dw, dh - 2 * z);
    // Highlight superior
    ctx.fillStyle = COLORS.deskLight;
    ctx.fillRect(x + 2 * z, y + z, dw - 4 * z, 2 * z);
    // Borda inferior
    ctx.fillStyle = COLORS.deskDark;
    ctx.fillRect(x + z, y + dh - 2 * z, dw - 2 * z, 2 * z);
    // Veio da madeira
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.fillRect(x + 4 * z, y + 4 * z, dw - 8 * z, z);
    ctx.fillRect(x + 6 * z, y + 7 * z, dw - 12 * z, z);

    // Monitor — com borda fina e glow
    const monW = 12 * z;
    const monH = 9 * z;
    const monX = x + (dw - monW) / 2;
    const monY = y - monH + 2 * z;

    // Glow atras do monitor
    ctx.fillStyle = "rgba(15, 52, 96, 0.15)";
    ctx.fillRect(monX - z, monY - z, monW + 2 * z, monH + 2 * z);

    // Corpo do monitor
    ctx.fillStyle = COLORS.monitor;
    ctx.fillRect(monX, monY, monW, monH);
    // Tela — com gradiente sutil
    ctx.fillStyle = COLORS.monitorScreenOn;
    ctx.fillRect(monX + z, monY + z, monW - 2 * z, monH - 3 * z);
    // Reflexo na tela
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(monX + 2 * z, monY + 2 * z, monW - 4 * z, 2 * z);
    // Indicador de energia
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(monX + monW - 2.5 * z, monY + monH - 2 * z, z, z);

    // Haste do monitor
    ctx.fillStyle = COLORS.monitor;
    ctx.fillRect(monX + monW / 2 - 1.5 * z, monY + monH, 3 * z, 2 * z);
    // Base do monitor
    ctx.fillRect(monX + monW / 2 - 3 * z, monY + monH + 2 * z, 6 * z, z);

    // Teclado — com teclas
    const kbW = 10 * z;
    const kbH = 3 * z;
    const kbX = x + (dw - kbW) / 2;
    const kbY = y + dh - 5 * z;
    ctx.fillStyle = "#333";
    ctx.fillRect(kbX, kbY, kbW, kbH);
    ctx.fillStyle = "#444";
    // Teclas (3 fileiras)
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.fillRect(kbX + (0.5 + c * 1.8) * z, kbY + (0.5 + r * 1.2) * z, 1.2 * z, z * 0.8);
      }
    }

    // Mouse
    ctx.fillStyle = "#444";
    ctx.fillRect(kbX + kbW + z, kbY + z * 0.5, 2 * z, 2.5 * z);
    ctx.fillStyle = "#555";
    ctx.fillRect(kbX + kbW + z * 1.3, kbY + z * 0.8, z * 0.5, z);
  }

  private renderRoomFurniture(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    rf: (typeof ROOM_FURNITURE)[number],
    deskLabel?: string
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

    // --- Room label (usa desk label do banco quando disponivel) ---
    {
      const room = ROOMS[rf.roomIndex];
      const displayLabel = deskLabel || room.label;
      const { x: sx, y: sy } = this.worldToScreen(
        state,
        (room.x + room.w / 2) * TILE_SIZE,
        (room.y + room.h - 1) * TILE_SIZE
      );
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.fillText(displayLabel, sx, sy);
      ctx.textAlign = "start";
    }
  }

  private renderMeetingRoom(
    ctx: CanvasRenderingContext2D,
    state: GameState
  ): void {
    const room = ROOMS[MEETING_ROOM_INDEX];
    if (!room) return;

    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;

    // Mesa de reuniao compacta no centro (7 wide x 4 tall)
    const tableW = 7;
    const tableH = 4;
    const tableX = room.x + Math.floor((room.w - tableW) / 2);
    const tableY = room.y + Math.floor((room.h - tableH) / 2);
    const { x: sx, y: sy } = this.worldToScreen(state, tableX * TILE_SIZE, tableY * TILE_SIZE);
    const tw = tableW * ts;
    const th = tableH * ts;

    // Mesa — arredondada com detalhes de madeira
    ctx.fillStyle = COLORS.desk;
    ctx.fillRect(sx + zoom, sy, tw - 2 * zoom, th);
    ctx.fillRect(sx, sy + zoom, tw, th - 2 * zoom);
    ctx.fillStyle = COLORS.deskLight;
    ctx.fillRect(sx + 2 * zoom, sy + zoom, tw - 4 * zoom, 3 * zoom);
    ctx.fillStyle = COLORS.deskDark;
    ctx.fillRect(sx + zoom, sy + th - 3 * zoom, tw - 2 * zoom, 3 * zoom);
    ctx.fillStyle = "#9a7420";
    ctx.fillRect(sx + 3 * zoom, sy + 5 * zoom, tw - 6 * zoom, th - 8 * zoom);
    // Veio da madeira
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(sx + 5 * zoom, sy + 6 * zoom, tw - 10 * zoom, zoom);
    ctx.fillRect(sx + 7 * zoom, sy + th / 2, tw - 14 * zoom, zoom);

    // Cadeiras (3 em cima, 3 embaixo) — posicionadas 1 tile acima/abaixo da mesa
    const chairW = 1.5 * ts;
    const chairH = 0.8 * ts;

    for (let i = 0; i < 3; i++) {
      const cx = sx + (0.8 + i * 2.2) * ts;
      // Cadeiras acima (1 tile de distância)
      ctx.fillStyle = COLORS.chair;
      ctx.fillRect(cx, sy - ts + 2 * zoom, chairW, chairH);
      ctx.fillStyle = COLORS.chairSeat;
      ctx.fillRect(cx + zoom, sy - ts + 3 * zoom, chairW - 2 * zoom, chairH - 2 * zoom);

      // Cadeiras abaixo (1 tile de distância)
      ctx.fillStyle = COLORS.chair;
      ctx.fillRect(cx, sy + th + ts - chairH - 2 * zoom, chairW, chairH);
      ctx.fillStyle = COLORS.chairSeat;
      ctx.fillRect(cx + zoom, sy + th + ts - chairH - zoom, chairW - 2 * zoom, chairH - 2 * zoom);
    }

    // Planta canto superior direito
    const plantX = room.x + room.w - 2;
    const plantY = room.y;
    const { x: px, y: py } = this.worldToScreen(state, plantX * TILE_SIZE, plantY * TILE_SIZE);
    ctx.fillStyle = COLORS.plantPot;
    ctx.fillRect(px + 3 * zoom, py + 8 * zoom, 10 * zoom, 6 * zoom);
    ctx.fillStyle = COLORS.plant;
    ctx.fillRect(px + 4 * zoom, py + 2 * zoom, 4 * zoom, 6 * zoom);
    ctx.fillRect(px + 8 * zoom, py + 3 * zoom, 4 * zoom, 5 * zoom);

    // Label
    const labelX = room.x + room.w / 2;
    const labelY = room.y + room.h - 0.5;
    const { x: lx, y: ly } = this.worldToScreen(state, labelX * TILE_SIZE, labelY * TILE_SIZE);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("MEETING ROOM", lx, ly);
    ctx.textAlign = "start";
  }

  private renderLockedDoor(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    roomIndex: number
  ): void {
    const door = ROOM_DOORS[roomIndex];
    if (!door) return;

    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;

    for (let i = 0; i < door.tiles.length; i++) {
      const tile = door.tiles[i];
      const { x: sx, y: sy } = this.worldToScreen(state, tile.x * TILE_SIZE, tile.y * TILE_SIZE);

      ctx.fillStyle = COLORS.doorLocked;
      ctx.fillRect(sx, sy, ts, ts);

      ctx.fillStyle = COLORS.doorLockedFrame;
      ctx.fillRect(sx, sy, ts, 2 * zoom);
      ctx.fillRect(sx, sy + ts - 2 * zoom, ts, 2 * zoom);
      ctx.fillRect(sx, sy, 2 * zoom, ts);
      ctx.fillRect(sx + ts - 2 * zoom, sy, 2 * zoom, ts);

      // Fechadura no tile central de cada grupo de 3
      if (i % 3 === 1) {
        ctx.fillStyle = "#ff4444";
        ctx.fillRect(sx + ts / 2 - 2 * zoom, sy + ts / 2 - 2 * zoom, 4 * zoom, 4 * zoom);
      }
    }
  }

  private renderCafeRoom(
    ctx: CanvasRenderingContext2D,
    state: GameState
  ): void {
    const room = ROOMS[CAFE_ROOM_INDEX];
    if (!room) return;

    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;

    // Balcão do café (canto superior direito, 2x3 vertical)
    const barX = room.x + room.w - 3;
    const barY = room.y;
    const { x: bx, y: by } = this.worldToScreen(state, barX * TILE_SIZE, barY * TILE_SIZE);
    ctx.fillStyle = COLORS.desk;
    ctx.fillRect(bx + zoom, by, 2 * ts - 2 * zoom, 3 * ts);
    ctx.fillRect(bx, by + zoom, 2 * ts, 3 * ts - 2 * zoom);
    ctx.fillStyle = COLORS.deskLight;
    ctx.fillRect(bx + 2 * zoom, by + zoom, 2 * ts - 4 * zoom, 2 * zoom);
    ctx.fillStyle = COLORS.deskDark;
    ctx.fillRect(bx + zoom, by + 3 * ts - 2 * zoom, 2 * ts - 2 * zoom, 2 * zoom);

    // Máquina de café
    const { x: mx, y: my } = this.worldToScreen(state, (barX + 0.3) * TILE_SIZE, (barY + 0.3) * TILE_SIZE);
    ctx.fillStyle = COLORS.coffeeMachine;
    ctx.fillRect(mx, my, 5 * zoom, 7 * zoom);
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(mx + zoom, my + 2 * zoom, zoom, zoom);
    ctx.fillStyle = COLORS.mug;
    ctx.fillRect(mx + 2 * zoom, my + 5 * zoom, 2 * zoom, 2 * zoom);

    // Segunda máquina
    const { x: m2x, y: m2y } = this.worldToScreen(state, (barX + 0.3) * TILE_SIZE, (barY + 1.5) * TILE_SIZE);
    ctx.fillStyle = COLORS.coffeeMachine;
    ctx.fillRect(m2x, m2y, 5 * zoom, 7 * zoom);
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(m2x + zoom, m2y + 2 * zoom, zoom, zoom);

    // 2 mesas com cadeiras
    const tables = [
      { x: room.x + 2, y: room.y + 1 },
      { x: room.x + 7, y: room.y + 1 },
    ];
    for (const table of tables) {
      const { x: tx, y: ty } = this.worldToScreen(state, table.x * TILE_SIZE, table.y * TILE_SIZE);
      // Sombra da mesa
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(tx + 3 * zoom, ty + 2 * ts - 2 * zoom, 3 * ts - 4 * zoom, 2 * zoom);

      // Mesa arredondada
      ctx.fillStyle = COLORS.coffeeTable;
      ctx.fillRect(tx + 3 * zoom, ty + 2 * zoom, 3 * ts - 6 * zoom, 2 * ts - 4 * zoom);
      ctx.fillRect(tx + 2 * zoom, ty + 3 * zoom, 3 * ts - 4 * zoom, 2 * ts - 6 * zoom);
      // Interior
      ctx.fillStyle = "#6b4a30";
      ctx.fillRect(tx + 4 * zoom, ty + 4 * zoom, 3 * ts - 8 * zoom, 2 * ts - 8 * zoom);
      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(tx + 5 * zoom, ty + 5 * zoom, 3 * ts - 12 * zoom, 2 * zoom);

      // Canecas com detalhe
      ctx.fillStyle = COLORS.mug;
      ctx.fillRect(tx + 5 * zoom, ty + 6 * zoom, 2.5 * zoom, 3 * zoom);
      ctx.fillStyle = COLORS.coffeeCup;
      ctx.fillRect(tx + 5.5 * zoom, ty + 6.5 * zoom, 1.5 * zoom, 2 * zoom);
      ctx.fillStyle = COLORS.mug;
      ctx.fillRect(tx + 3 * ts - 9 * zoom, ty + 2 * ts - 10 * zoom, 2.5 * zoom, 3 * zoom);

      // Cadeiras — mais compactas e dentro da area da mesa
      const cw = ts * 0.8;
      const ch = ts * 0.5;
      // Cadeira cima
      ctx.fillStyle = COLORS.chair;
      ctx.fillRect(tx + ts + zoom, ty - ch - zoom, cw, ch);
      ctx.fillStyle = COLORS.chairSeat;
      ctx.fillRect(tx + ts + 2 * zoom, ty - ch, cw - 2 * zoom, ch - zoom);
      // Cadeira baixo
      ctx.fillStyle = COLORS.chair;
      ctx.fillRect(tx + ts + zoom, ty + 2 * ts + zoom, cw, ch);
      ctx.fillStyle = COLORS.chairSeat;
      ctx.fillRect(tx + ts + 2 * zoom, ty + 2 * ts + 2 * zoom, cw - 2 * zoom, ch - zoom);
    }

    // Planta canto inferior esquerdo
    const plantX = room.x;
    const plantY = room.y + room.h - 2;
    const { x: px, y: py } = this.worldToScreen(state, plantX * TILE_SIZE, plantY * TILE_SIZE);
    ctx.fillStyle = COLORS.plantPot;
    ctx.fillRect(px + 3 * zoom, py + 8 * zoom, 10 * zoom, 6 * zoom);
    ctx.fillStyle = COLORS.plant;
    ctx.fillRect(px + 4 * zoom, py + 2 * zoom, 4 * zoom, 6 * zoom);
    ctx.fillRect(px + 8 * zoom, py + 3 * zoom, 4 * zoom, 5 * zoom);

    // Label
    const cafeLabelX = room.x + room.w / 2;
    const cafeLabelY = room.y + room.h - 0.5;
    const { x: clx, y: cly } = this.worldToScreen(state, cafeLabelX * TILE_SIZE, cafeLabelY * TILE_SIZE);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("CAFÉ", clx, cly);
    ctx.textAlign = "start";
  }

  private renderDoorHighlight(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    roomIndex: number,
    isLocked: boolean
  ): void {
    const door = ROOM_DOORS[roomIndex];
    if (!door) return;

    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;
    const pulse = Math.sin(state.time * 4) * 0.3 + 0.7;

    for (const tile of door.tiles) {
      const { x: sx, y: sy } = this.worldToScreen(state, tile.x * TILE_SIZE, tile.y * TILE_SIZE);

      ctx.strokeStyle = isLocked
        ? `rgba(255, 68, 68, ${pulse})`
        : `rgba(79, 195, 247, ${pulse})`;
      ctx.lineWidth = 2 * zoom;
      ctx.strokeRect(sx + zoom, sy + zoom, ts - 2 * zoom, ts - 2 * zoom);
    }
  }

  private renderGarden(
    ctx: CanvasRenderingContext2D,
    state: GameState
  ): void {
    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;

    // Flores espalhadas pela grama
    const flowers = [
      { x: GARDEN.x + 1, y: GARDEN.y + 1, color: COLORS.flowerRed },
      { x: GARDEN.x + 4, y: GARDEN.y + 2, color: COLORS.flowerYellow },
      { x: GARDEN.x + 8, y: GARDEN.y + 1, color: COLORS.flowerBlue },
      { x: GARDEN.x + 2, y: GARDEN.y + 5, color: COLORS.flowerPink },
      { x: GARDEN.x + 10, y: GARDEN.y + 4, color: COLORS.flowerRed },
      { x: GARDEN.x + 6, y: GARDEN.y + 7, color: COLORS.flowerYellow },
      { x: GARDEN.x + 11, y: GARDEN.y + 8, color: COLORS.flowerBlue },
      { x: GARDEN.x + 1, y: GARDEN.y + 8, color: COLORS.flowerPink },
    ];

    for (const f of flowers) {
      const { x: fx, y: fy } = this.worldToScreen(state, f.x * TILE_SIZE, f.y * TILE_SIZE);
      // Caule
      ctx.fillStyle = COLORS.plantDark;
      ctx.fillRect(fx + ts / 2 - zoom * 0.5, fy + ts * 0.4, zoom, ts * 0.5);
      // Petala
      ctx.fillStyle = f.color;
      ctx.fillRect(fx + ts / 2 - 2 * zoom, fy + ts * 0.15, 4 * zoom, 4 * zoom);
      // Centro
      ctx.fillStyle = "#fff";
      ctx.fillRect(fx + ts / 2 - zoom * 0.5, fy + ts * 0.25, zoom, zoom);
    }

    // Arvores (2 arvores nas bordas)
    const trees = [
      { x: GARDEN.x, y: GARDEN.y },
      { x: GARDEN.x + GARDEN.w - 2, y: GARDEN.y + GARDEN.h - 3 },
      { x: GARDEN.x + 5, y: GARDEN.y + GARDEN.h - 2 },
    ];

    for (const t of trees) {
      const { x: tx, y: ty } = this.worldToScreen(state, t.x * TILE_SIZE, t.y * TILE_SIZE);
      // Tronco
      ctx.fillStyle = COLORS.treeTrunk;
      ctx.fillRect(tx + ts * 0.6, ty + ts * 1.2, ts * 0.5, ts * 0.8);
      // Copa
      ctx.fillStyle = COLORS.treeLeaf;
      ctx.fillRect(tx, ty, ts * 1.8, ts * 1.3);
      ctx.fillStyle = COLORS.treeLeafDark;
      ctx.fillRect(tx + 2 * zoom, ty + 2 * zoom, ts * 1.4, ts * 0.9);
      // Highlight
      ctx.fillStyle = COLORS.grassLight;
      ctx.fillRect(tx + 3 * zoom, ty + 3 * zoom, ts * 0.5, ts * 0.3);
    }

    // Cerca no topo do jardim (borda superior)
    for (let x = GARDEN.x; x < GARDEN.x + GARDEN.w; x++) {
      const { x: fx, y: fy } = this.worldToScreen(state, x * TILE_SIZE, (GARDEN.y - 0.3) * TILE_SIZE);
      ctx.fillStyle = COLORS.fence;
      // Poste vertical
      if (x % 2 === 0) {
        ctx.fillRect(fx + ts * 0.35, fy, ts * 0.3, ts * 0.7);
      }
      // Barra horizontal
      ctx.fillRect(fx, fy + ts * 0.15, ts, 2 * zoom);
      ctx.fillRect(fx, fy + ts * 0.45, ts, 2 * zoom);
    }

    // Label
    const labelX = GARDEN.x + GARDEN.w / 2;
    const labelY = GARDEN.y + GARDEN.h - 0.5;
    const { x: lx, y: ly } = this.worldToScreen(state, labelX * TILE_SIZE, labelY * TILE_SIZE);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("GARDEN", lx, ly);
    ctx.textAlign = "start";
  }

  private renderDog(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    petFrame: number
  ): void {
    const z = state.camera.zoom;
    const { x: dx, y: dy } = this.worldToScreen(
      state,
      DOG_POSITION.x * TILE_SIZE,
      DOG_POSITION.y * TILE_SIZE
    );

    const tailPhase = Math.sin(state.time * 6);
    const isPetted = petFrame >= 0 && petFrame < 60;
    const bob = isPetted ? Math.sin(state.time * 10) * z : 0;
    const breathe = Math.sin(state.time * 2) * z * 0.3;

    // Sombra
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(dx + 2 * z, dy + 13 * z, 13 * z, 2 * z);

    // Rabo
    ctx.fillStyle = COLORS.dogBody;
    const tailAngle = tailPhase * 2 * z;
    ctx.fillRect(dx, dy + 3 * z + tailAngle + bob, 2 * z, 4 * z);
    ctx.fillStyle = COLORS.dogBodyDark;
    ctx.fillRect(dx, dy + 3 * z + tailAngle + bob, z, 4 * z);

    // Corpo — arredondado
    ctx.fillStyle = COLORS.dogBody;
    ctx.fillRect(dx + 2 * z, dy + 5 * z + bob + breathe, 11 * z, 7 * z);
    ctx.fillRect(dx + 3 * z, dy + 4 * z + bob + breathe, 9 * z, z); // costas arredondada
    // Barriga (mais clara)
    ctx.fillStyle = "#d4a84a";
    ctx.fillRect(dx + 4 * z, dy + 9 * z + bob + breathe, 7 * z, 2 * z);
    // Sombra corporal
    ctx.fillStyle = COLORS.dogBodyDark;
    ctx.fillRect(dx + 2 * z, dy + 11 * z + bob + breathe, 11 * z, z);

    // Cabeca — arredondada
    ctx.fillStyle = COLORS.dogBody;
    ctx.fillRect(dx + 11 * z, dy + 2 * z + bob, 5 * z, 7 * z);
    ctx.fillRect(dx + 12 * z, dy + z + bob, 3 * z, z); // topo arredondado
    // Focinho (area mais clara)
    ctx.fillStyle = "#d4a84a";
    ctx.fillRect(dx + 13 * z, dy + 6 * z + bob, 3 * z, 2 * z);

    // Orelha — caida
    ctx.fillStyle = COLORS.dogEar;
    ctx.fillRect(dx + 14 * z, dy + bob, 2 * z, 4 * z);
    ctx.fillStyle = COLORS.dogBodyDark;
    ctx.fillRect(dx + 14 * z, dy + bob, z, 4 * z); // sombra orelha

    // Olho — com brilho
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(dx + 12 * z, dy + 3.5 * z + bob, 1.5 * z, 1.5 * z);
    ctx.fillStyle = "#fff";
    ctx.fillRect(dx + 12 * z, dy + 3.5 * z + bob, z * 0.6, z * 0.6);

    // Nariz
    ctx.fillStyle = COLORS.dogNose;
    ctx.fillRect(dx + 15 * z, dy + 5.5 * z + bob, z * 1.2, z);

    // Lingua
    if (isPetted) {
      ctx.fillStyle = COLORS.dogTongue;
      ctx.fillRect(dx + 14 * z, dy + 8 * z + bob, z, 2.5 * z);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(dx + 14 * z, dy + 10 * z + bob, z, z * 0.5);
    }

    // Patas — com detalhe
    const patas = [3, 5, 9, 11];
    for (const px of patas) {
      ctx.fillStyle = COLORS.dogBodyDark;
      ctx.fillRect(dx + px * z, dy + 12 * z + bob + breathe, 2 * z, 2 * z);
      ctx.fillStyle = "#d4a84a";
      ctx.fillRect(dx + px * z, dy + 13 * z + bob + breathe, 2 * z, z);
    }

    // Coleira
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(dx + 10 * z, dy + 8 * z + bob, z, 2 * z);
    ctx.fillStyle = "#f1c40f";
    ctx.fillRect(dx + 10 * z, dy + 9 * z + bob, z, z);

    // Coracao flutuante quando acariciado
    if (isPetted) {
      const heartY = dy - 6 * z - (petFrame * 0.4 * z);
      const heartAlpha = Math.max(0, 1 - petFrame / 60);
      ctx.fillStyle = `rgba(233, 69, 96, ${heartAlpha})`;
      const hx = dx + 8 * z;
      ctx.fillRect(hx, heartY + z, 2 * z, 2 * z);
      ctx.fillRect(hx + 3 * z, heartY + z, 2 * z, 2 * z);
      ctx.fillRect(hx - z, heartY + 3 * z, 7 * z, 2 * z);
      ctx.fillRect(hx, heartY + 5 * z, 5 * z, z);
      ctx.fillRect(hx + z, heartY + 6 * z, 3 * z, z);
      ctx.fillRect(hx + 2 * z, heartY + 7 * z, z, z);
    }
  }

  private renderChatBubble(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    character: Character,
    bubble: ChatBubble
  ): void {
    const px = character.gridX * TILE_SIZE;
    const py = character.gridY * TILE_SIZE;
    const { x, y } = this.worldToScreen(state, px, py);
    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;

    const fontSize = Math.max(6, 6 * zoom);
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;

    // Mede texto e quebra em linhas
    const maxLineWidth = 120 * zoom;
    const words = bubble.message.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = ctx.measureText(testLine).width;
      if (width > maxLineWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = fontSize + 2 * zoom;
    const paddingX = 6 * zoom;
    const paddingY = 4 * zoom;

    // Calcula tamanho do balao
    let bubbleWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > bubbleWidth) bubbleWidth = w;
    }
    bubbleWidth += paddingX * 2;
    const bubbleHeight = lines.length * lineHeight + paddingY * 2;

    // Posicao do balao (acima do personagem, flutuando)
    const age = Date.now() - bubble.timestamp;
    const floatUp = Math.min(age / 200, 8) * zoom; // sobe suavemente
    const bubbleX = x + ts / 2 - bubbleWidth / 2;
    const bubbleY = y - bubbleHeight - 20 * zoom - floatUp - (character.jumpOffset * zoom);

    ctx.globalAlpha = bubble.opacity;

    // Fundo do balao
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

    // Borda pixel
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = zoom;
    ctx.strokeRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

    // Pontinha triangular (seta apontando para baixo)
    const tipX = x + ts / 2;
    const tipY = bubbleY + bubbleHeight;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(tipX - 4 * zoom, tipY);
    ctx.lineTo(tipX + 4 * zoom, tipY);
    ctx.lineTo(tipX, tipY + 5 * zoom);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cobre a borda do fundo onde a ponta se conecta
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(tipX - 3 * zoom, tipY - zoom, 6 * zoom, zoom * 2);

    // Texto
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "center";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(
        lines[i],
        bubbleX + bubbleWidth / 2,
        bubbleY + paddingY + (i + 1) * lineHeight - 2 * zoom
      );
    }
    ctx.textAlign = "start";

    ctx.globalAlpha = 1;
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
    const cy = y + (TILE_SIZE * zoom - ch) - (character.jumpOffset * zoom);

    const animFrame = character.animationFrame;
    const charState = character.state;

    // Set per-character color overrides
    this.skinColor = character.colorSkin || COLORS.skin;
    this.hairColor = character.colorHair || COLORS.hair;
    this.currentHairStyle = character.hairStyle || "short";

    // Usa colorShirt customizado, com fallback para color (sprite default)
    const shirtColor = character.colorShirt || character.color;

    // Seta direction para uso no drawPixelBody
    // Left usa o desenho de "right" espelhado horizontalmente
    const facingLeft = character.direction === "left";
    this.currentDirection = facingLeft ? "right" : character.direction;

    if (facingLeft) {
      ctx.save();
      ctx.scale(-1, 1);
    }
    const drawX = facingLeft ? -(cx + cw) : cx;

    // Draw character based on state
    switch (charState) {
      case "typing":
        this.drawTypingCharacter(ctx, drawX, cy, cw, ch, zoom, shirtColor, animFrame);
        break;
      case "focused":
        this.drawFocusedCharacter(ctx, drawX, cy, cw, ch, zoom, shirtColor, animFrame);
        break;
      case "drinking_coffee":
        this.drawCoffeeCharacter(ctx, drawX, cy, cw, ch, zoom, shirtColor, animFrame, state.time);
        break;
      case "sleeping":
        this.drawSleepingCharacter(ctx, drawX, cy, cw, ch, zoom, shirtColor, animFrame, state.time);
        break;
      case "walking":
        this.drawWalkingCharacter(ctx, drawX, cy, cw, ch, zoom, shirtColor, animFrame);
        break;
      case "idle":
        this.drawIdleCharacter(ctx, drawX, cy, cw, ch, zoom, shirtColor, animFrame);
        break;
      case "dancing":
        this.drawDancingCharacter(ctx, drawX, cy, cw, ch, zoom, shirtColor, animFrame, state.time);
        break;
      case "walking_coffee":
        this.drawWalkingCoffeeCharacter(ctx, drawX, cy, cw, ch, zoom, shirtColor, animFrame, state.time);
        break;
      case "waving":
        this.drawWavingCharacter(ctx, drawX, cy, cw, ch, zoom, shirtColor, animFrame, state.time);
        break;
      case "sitting_floor":
        this.drawSittingFloorCharacter(ctx, drawX, cy, cw, ch, zoom, shirtColor, animFrame);
        break;
    }

    if (facingLeft) {
      ctx.restore();
    }

    // Calcula posicao real da cabeca por estado (para acessorios)
    const headSize = cw * 0.6;
    let accHeadX = cx + (cw - headSize) / 2;
    let accHeadY = cy;

    if (charState === "dancing") {
      const phase = animFrame % 4;
      const leanX = phase < 2 ? -1.5 * zoom : 1.5 * zoom;
      const bounceY = phase % 2 === 0 ? -2 * zoom : 0;
      accHeadX = cx + leanX + (cw - headSize) / 2;
      accHeadY = cy + bounceY;
    } else if (charState === "sitting_floor") {
      accHeadY = cy + ch * 0.25;
    } else if (charState === "walking" || charState === "walking_coffee" || charState === "drinking_coffee") {
      const bounce = animFrame % 2 === 0 ? 0 : -1 * zoom;
      accHeadY = cy + bounce;
    }

    // Accessories
    const showFace = character.direction !== "up";
    if (character.hat && character.hat !== "none" && charState !== "sleeping") {
      if (facingLeft) {
        ctx.save();
        ctx.scale(-1, 1);
        this.drawHat(ctx, -(accHeadX + headSize), accHeadY, headSize, zoom, character.hat);
        ctx.restore();
      } else {
        this.drawHat(ctx, accHeadX, accHeadY, headSize, zoom, character.hat);
      }
    }

    if (showFace && character.glasses && character.glasses !== "none" && charState !== "sleeping") {
      if (facingLeft) {
        ctx.save();
        ctx.scale(-1, 1);
        this.drawGlasses(ctx, -(accHeadX + headSize), accHeadY, headSize, zoom, character.glasses);
        ctx.restore();
      } else {
        this.drawGlasses(ctx, accHeadX, accHeadY, headSize, zoom, character.glasses);
      }
    }

    // Name label
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    const nameY = character.hat && character.hat !== "none" && charState !== "sleeping" ? accHeadY - 10 * zoom : accHeadY - 6 * zoom;
    ctx.fillText(character.name, cx + cw / 2, nameY);
    ctx.textAlign = "start";

    // Status dot — acompanha posicao da cabeca, sobe no waving pra nao cobrir a mao
    const dotSize = 3 * zoom;
    const dotY = charState === "waving" ? accHeadY - 6 * zoom : accHeadY + 2 * zoom;
    ctx.fillStyle = STATUS_COLORS[status];
    ctx.beginPath();
    ctx.arc(cx + cw + 2 * zoom, dotY, dotSize, 0, Math.PI * 2);
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
      case "witch": {
        // Chapeu de bruxa
        ctx.fillStyle = "#2d1b69";
        // Aba larga
        ctx.fillRect(headX - 3 * zoom, headY - 1 * zoom, headSize + 6 * zoom, 2 * zoom);
        // Cone
        ctx.fillRect(headX, headY - 5 * zoom, headSize, 4 * zoom);
        ctx.fillRect(headX + 1 * zoom, headY - 8 * zoom, headSize - 2 * zoom, 3 * zoom);
        ctx.fillRect(headX + 2 * zoom, headY - 10 * zoom, headSize - 4 * zoom, 2 * zoom);
        // Faixa
        ctx.fillStyle = "#f39c12";
        ctx.fillRect(headX, headY - 3 * zoom, headSize, 1.5 * zoom);
        break;
      }
      case "santa": {
        // Gorro de Papai Noel
        ctx.fillStyle = "#c0392b";
        ctx.fillRect(headX - 1 * zoom, headY - 2 * zoom, headSize + 2 * zoom, 4 * zoom);
        ctx.fillRect(headX + 1 * zoom, headY - 5 * zoom, headSize - 2 * zoom, 3 * zoom);
        ctx.fillRect(headX + 3 * zoom, headY - 7 * zoom, headSize - 6 * zoom, 2 * zoom);
        // Borda branca
        ctx.fillStyle = "#ecf0f1";
        ctx.fillRect(headX - 1 * zoom, headY, headSize + 2 * zoom, 2 * zoom);
        // Pompom
        ctx.fillRect(headX + headSize - 3 * zoom, headY - 8 * zoom, 3 * zoom, 3 * zoom);
        break;
      }
      case "beret": {
        // Boina francesa
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(headX - 2 * zoom, headY - 2 * zoom, headSize + 4 * zoom, 3 * zoom);
        ctx.fillRect(headX - 1 * zoom, headY - 4 * zoom, headSize + 2 * zoom, 2 * zoom);
        // Haste da boina
        ctx.fillRect(headX + headSize / 2 - 1 * zoom, headY - 5 * zoom, 2 * zoom, 1.5 * zoom);
        break;
      }
      case "cowboy": {
        // Chapéu de cowboy
        ctx.fillStyle = "#8B4513";
        // Aba larga
        ctx.fillRect(headX - 4 * zoom, headY - 1 * zoom, headSize + 8 * zoom, 2 * zoom);
        // Copa
        ctx.fillRect(headX, headY - 5 * zoom, headSize, 4 * zoom);
        ctx.fillRect(headX + 1 * zoom, headY - 7 * zoom, headSize - 2 * zoom, 2 * zoom);
        // Faixa
        ctx.fillStyle = "#d4a574";
        ctx.fillRect(headX, headY - 3 * zoom, headSize, 1.5 * zoom);
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
      case "aviator": {
        // Oculos aviador — lentes grandes teardrops
        ctx.fillStyle = "rgba(139, 90, 43, 0.6)";
        // Lente esquerda (teardrop)
        ctx.fillRect(headX + 0.5 * zoom, eyeY - 1 * zoom, 4 * zoom, 4 * zoom);
        // Lente direita
        ctx.fillRect(headX + headSize - 4.5 * zoom, eyeY - 1 * zoom, 4 * zoom, 4 * zoom);
        // Armacao dourada
        ctx.strokeStyle = "#c0a030";
        ctx.lineWidth = zoom * 0.7;
        ctx.strokeRect(headX + 0.5 * zoom, eyeY - 1 * zoom, 4 * zoom, 4 * zoom);
        ctx.strokeRect(headX + headSize - 4.5 * zoom, eyeY - 1 * zoom, 4 * zoom, 4 * zoom);
        // Ponte
        ctx.beginPath();
        ctx.moveTo(headX + 4.5 * zoom, eyeY + 0.5 * zoom);
        ctx.lineTo(headX + headSize - 4.5 * zoom, eyeY + 0.5 * zoom);
        ctx.stroke();
        break;
      }
      case "pixel": {
        // Oculos pixel / 8-bit (tipo "deal with it")
        ctx.fillStyle = "#000000";
        // Lente esquerda (quadrada grossa)
        ctx.fillRect(headX + 0.5 * zoom, eyeY - 0.5 * zoom, 4 * zoom, 3 * zoom);
        // Lente direita
        ctx.fillRect(headX + headSize - 4.5 * zoom, eyeY - 0.5 * zoom, 4 * zoom, 3 * zoom);
        // Ponte grossa
        ctx.fillRect(headX + 4.5 * zoom, eyeY, headSize - 9 * zoom, 1.5 * zoom);
        // Reflexo
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(headX + 1 * zoom, eyeY, 1.5 * zoom, 1 * zoom);
        ctx.fillRect(headX + headSize - 4 * zoom, eyeY, 1.5 * zoom, 1 * zoom);
        break;
      }
      case "heart": {
        // Oculos de coracao
        ctx.fillStyle = "#e74c3c";
        // Coracao esquerdo
        ctx.beginPath();
        const lhx = headX + 2.5 * zoom;
        const lhy = eyeY + 1 * zoom;
        const hr = 1.8 * zoom;
        ctx.arc(lhx - hr * 0.5, lhy - hr * 0.3, hr, 0, Math.PI * 2);
        ctx.arc(lhx + hr * 0.5, lhy - hr * 0.3, hr, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(lhx - hr * 1.2, lhy);
        ctx.lineTo(lhx, lhy + hr * 1.4);
        ctx.lineTo(lhx + hr * 1.2, lhy);
        ctx.fill();
        // Coracao direito
        const rhx = headX + headSize - 2.5 * zoom;
        ctx.beginPath();
        ctx.arc(rhx - hr * 0.5, lhy - hr * 0.3, hr, 0, Math.PI * 2);
        ctx.arc(rhx + hr * 0.5, lhy - hr * 0.3, hr, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(rhx - hr * 1.2, lhy);
        ctx.lineTo(rhx, lhy + hr * 1.4);
        ctx.lineTo(rhx + hr * 1.2, lhy);
        ctx.fill();
        // Ponte
        ctx.fillStyle = "#c0392b";
        ctx.fillRect(headX + 4 * zoom, eyeY + 0.5 * zoom, headSize - 8 * zoom, 1 * zoom);
        break;
      }
    }
  }

  private drawHairStyle(
    ctx: CanvasRenderingContext2D,
    headX: number, headY: number, headSize: number, zoom: number
  ): void {
    ctx.fillStyle = this.hairColor;
    const hs = this.currentHairStyle;

    switch (hs) {
      case "bald":
        // Sem cabelo
        break;
      case "buzz":
        // Cabelo raspado — fina camada
        ctx.globalAlpha = 0.5;
        ctx.fillRect(headX, headY, headSize, 2 * zoom);
        ctx.globalAlpha = 1;
        break;
      case "short":
      default:
        // Cabelo curto padrao
        ctx.fillRect(headX, headY, headSize, 3 * zoom);
        break;
      case "spiky": {
        // Base
        ctx.fillRect(headX, headY, headSize, 2.5 * zoom);
        // Pontas
        const spikeW = 2 * zoom;
        for (let sx = headX; sx < headX + headSize - 1; sx += spikeW + zoom) {
          ctx.fillRect(sx, headY - 2 * zoom, spikeW, 2.5 * zoom);
        }
        break;
      }
      case "messy": {
        // Cabelo bagunçado — irregular
        ctx.fillRect(headX, headY, headSize, 3 * zoom);
        ctx.fillRect(headX - 1 * zoom, headY + 1 * zoom, 2 * zoom, 2 * zoom);
        ctx.fillRect(headX + headSize - 1 * zoom, headY, 2 * zoom, 2 * zoom);
        ctx.fillRect(headX + 2 * zoom, headY - 1 * zoom, 3 * zoom, 1.5 * zoom);
        break;
      }
      case "long_straight": {
        // Cabelo longo liso — cai dos lados
        ctx.fillRect(headX, headY, headSize, 3 * zoom);
        // Lado esquerdo desce
        ctx.fillRect(headX - 1.5 * zoom, headY + 1 * zoom, 2 * zoom, headSize + 4 * zoom);
        // Lado direito desce
        ctx.fillRect(headX + headSize - 0.5 * zoom, headY + 1 * zoom, 2 * zoom, headSize + 4 * zoom);
        break;
      }
      case "long_wavy": {
        // Cabelo longo ondulado
        ctx.fillRect(headX, headY, headSize, 3 * zoom);
        // Ondas dos lados
        ctx.fillRect(headX - 2 * zoom, headY + 1 * zoom, 2.5 * zoom, headSize + 3 * zoom);
        ctx.fillRect(headX - 1 * zoom, headY + headSize + 2 * zoom, 2 * zoom, 3 * zoom);
        ctx.fillRect(headX + headSize - 0.5 * zoom, headY + 1 * zoom, 2.5 * zoom, headSize + 3 * zoom);
        ctx.fillRect(headX + headSize, headY + headSize + 2 * zoom, 2 * zoom, 3 * zoom);
        break;
      }
      case "ponytail": {
        // Cabelo preso — franja + rabo atras
        ctx.fillRect(headX, headY, headSize, 3 * zoom);
        // Rabo para direita
        ctx.fillRect(headX + headSize, headY + 2 * zoom, 2 * zoom, 2 * zoom);
        ctx.fillRect(headX + headSize + 1 * zoom, headY + 3 * zoom, 2 * zoom, 4 * zoom);
        ctx.fillRect(headX + headSize, headY + 6 * zoom, 2 * zoom, 3 * zoom);
        break;
      }
      case "pigtails": {
        // Maria-chiquinha — dois rabos laterais
        ctx.fillRect(headX, headY, headSize, 3 * zoom);
        // Rabo esquerdo
        ctx.fillRect(headX - 2 * zoom, headY + 2 * zoom, 2 * zoom, 5 * zoom);
        ctx.fillRect(headX - 1.5 * zoom, headY + 6 * zoom, 2 * zoom, 3 * zoom);
        // Rabo direito
        ctx.fillRect(headX + headSize, headY + 2 * zoom, 2 * zoom, 5 * zoom);
        ctx.fillRect(headX + headSize - 0.5 * zoom, headY + 6 * zoom, 2 * zoom, 3 * zoom);
        break;
      }
      case "mohawk": {
        // Moicano — crista central
        const mohawkW = 3 * zoom;
        const mohawkX = headX + (headSize - mohawkW) / 2;
        ctx.fillRect(mohawkX, headY - 4 * zoom, mohawkW, 4 * zoom + 2 * zoom);
        // Base dos lados raspada
        ctx.globalAlpha = 0.3;
        ctx.fillRect(headX, headY, headSize, 2 * zoom);
        ctx.globalAlpha = 1;
        break;
      }
      case "afro": {
        // Afro — volume esférico
        const afroPad = 3 * zoom;
        ctx.beginPath();
        ctx.arc(
          headX + headSize / 2,
          headY + headSize * 0.3,
          headSize / 2 + afroPad,
          0, Math.PI * 2
        );
        ctx.fill();
        // Redesenha o rosto por cima
        ctx.fillStyle = this.skinColor;
        ctx.fillRect(headX + 1 * zoom, headY + 2 * zoom, headSize - 2 * zoom, headSize - 2 * zoom);
        break;
      }
      case "bob": {
        // Cabelo bob / chanel
        ctx.fillRect(headX - 1 * zoom, headY, headSize + 2 * zoom, 3 * zoom);
        // Lados descendo ate abaixo da orelha
        ctx.fillRect(headX - 1.5 * zoom, headY + 1 * zoom, 2.5 * zoom, headSize - 1 * zoom);
        ctx.fillRect(headX + headSize - 1 * zoom, headY + 1 * zoom, 2.5 * zoom, headSize - 1 * zoom);
        // Franja
        ctx.fillRect(headX, headY, headSize, 2 * zoom);
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
    const z = zoom;
    const headSize = w * 0.65;
    const headX = x + (w - headSize) / 2;
    const dir = this.currentDirection;
    const isSide = dir === "left" || dir === "right";
    const isBack = dir === "up";

    // Sombra no chao
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(x + z, y + h - z, w - 2 * z, 2 * z);

    // Head — formato arredondado
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(headX + z, y, headSize - 2 * z, headSize);
    ctx.fillRect(headX, y + z, headSize, headSize - 2 * z);

    // Sombra lateral da cabeca
    ctx.fillStyle = COLORS.skinShadow;
    if (isSide) {
      ctx.fillRect(headX + headSize - 2 * z, y + 2 * z, z, headSize - 4 * z);
    } else {
      ctx.fillRect(headX + headSize - 2 * z, y + 2 * z, z * 0.7, headSize - 4 * z);
    }

    // Hair
    this.drawHairStyle(ctx, headX, y, headSize, z);

    if (isBack) {
      // COSTAS — sem rosto, cabelo cobre mais
      ctx.fillStyle = this.hairColor;
      ctx.fillRect(headX + z, y + headSize * 0.3, headSize - 2 * z, headSize * 0.5);
    } else if (isSide) {
      // LADO — 1 olho visivel, nariz, orelha
      const eyeY = y + headSize * 0.42;
      // Olho (apenas 1, do lado da frente)
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(headX + headSize - 4 * z, eyeY, 2 * z, 2 * z);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(headX + headSize - 4 * z, eyeY, z * 0.7, z * 0.7);
      // Nariz (protuberancia lateral)
      ctx.fillStyle = COLORS.skinShadow;
      ctx.fillRect(headX + headSize - z, y + headSize * 0.5, z, z);
      // Boquinha
      ctx.fillStyle = COLORS.skinShadow;
      ctx.fillRect(headX + headSize - 3 * z, y + headSize * 0.7, z * 1.2, z * 0.5);
      // Orelha (lado de tras)
      ctx.fillStyle = this.skinColor;
      ctx.fillRect(headX - z * 0.5, y + headSize * 0.35, z, 2 * z);
      ctx.fillStyle = COLORS.skinShadow;
      ctx.fillRect(headX - z * 0.5, y + headSize * 0.35, z * 0.5, 2 * z);
    } else {
      // FRENTE (down) — 2 olhos, boca
      const eyeY = y + headSize * 0.42;
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(headX + 2.5 * z, eyeY, 2 * z, 2 * z);
      ctx.fillRect(headX + headSize - 4.5 * z, eyeY, 2 * z, 2 * z);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(headX + 2.5 * z, eyeY, z * 0.7, z * 0.7);
      ctx.fillRect(headX + headSize - 4.5 * z, eyeY, z * 0.7, z * 0.7);
      // Boquinha
      ctx.fillStyle = COLORS.skinShadow;
      ctx.fillRect(headX + headSize / 2 - z * 0.5, y + headSize * 0.7, z * 1.5, z * 0.5);
    }

    // Pescoco
    ctx.fillStyle = this.skinColor;
    const neckW = w * 0.2;
    ctx.fillRect(x + (w - neckW) / 2, y + headSize - z * 0.5, neckW, 2 * z);

    // Corpo / camisa
    const bodyY = y + headSize + z;
    const bodyH = h * 0.32;
    const bodyW = w - 2 * z;
    ctx.fillStyle = shirtColor;
    ctx.fillRect(x + z, bodyY, bodyW, bodyH);

    if (isBack) {
      // Costas — linha da coluna
      ctx.fillStyle = this.darkenColor(shirtColor, 15);
      ctx.fillRect(x + w / 2 - z * 0.5, bodyY + z, z, bodyH - 2 * z);
    } else if (isSide) {
      // Lado — corpo mais estreito visualmente, sombra forte
      ctx.fillStyle = this.darkenColor(shirtColor, 30);
      ctx.fillRect(x + bodyW, bodyY + z, z, bodyH - 2 * z);
    } else {
      // Frente — gola
      ctx.fillStyle = this.darkenColor(shirtColor, 20);
      ctx.fillRect(x + w / 2 - z, bodyY, 2 * z, 3 * z);
      ctx.fillStyle = this.darkenColor(shirtColor, 30);
      ctx.fillRect(x + bodyW, bodyY + z, z, bodyH - 2 * z);
    }

    // Calca — com divisao de pernas
    ctx.fillStyle = COLORS.pants;
    const pantsY = bodyY + bodyH;
    const pantsH = h * 0.22;
    const legW = (bodyW - z) / 2;
    ctx.fillRect(x + z, pantsY, legW, pantsH);
    ctx.fillRect(x + z + legW + z, pantsY, legW, pantsH);
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(x + z, pantsY + pantsH - z, bodyW, z);

    // Sapatos
    ctx.fillStyle = "#222";
    ctx.fillRect(x + z * 0.5, pantsY + pantsH, legW + z * 0.5, z * 1.2);
    ctx.fillRect(x + z + legW + z * 0.5, pantsY + pantsH, legW + z * 0.5, z * 1.2);
  }

  private darkenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return `rgb(${r},${g},${b})`;
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

  private drawDancingCharacter(
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
    // Bounce lateral e vertical para dar sensacao de danca
    const phase = frame % 4;
    const bounceY = phase % 2 === 0 ? -2 * zoom : 0;
    const leanX = phase < 2 ? -1.5 * zoom : 1.5 * zoom;

    this.drawPixelBody(ctx, x + leanX, y + bounceY, w, h, zoom, color);

    // Bracos em posicoes de danca — alternam entre cima e lado
    ctx.fillStyle = this.skinColor;
    if (phase === 0) {
      // Braco esquerdo levantado, direito no quadril
      ctx.fillRect(x + leanX - 2 * zoom, y + bounceY + h * 0.2, 2 * zoom, 4 * zoom);
      ctx.fillRect(x + leanX + w - 1 * zoom, y + bounceY + h * 0.5, 2 * zoom, 4 * zoom);
    } else if (phase === 1) {
      // Ambos levantados
      ctx.fillRect(x + leanX - 2 * zoom, y + bounceY + h * 0.15, 2 * zoom, 4 * zoom);
      ctx.fillRect(x + leanX + w, y + bounceY + h * 0.15, 2 * zoom, 4 * zoom);
    } else if (phase === 2) {
      // Braco direito levantado, esquerdo no quadril
      ctx.fillRect(x + leanX - 1 * zoom, y + bounceY + h * 0.5, 2 * zoom, 4 * zoom);
      ctx.fillRect(x + leanX + w, y + bounceY + h * 0.2, 2 * zoom, 4 * zoom);
    } else {
      // Ambos levantados (invertido)
      ctx.fillRect(x + leanX - 2 * zoom, y + bounceY + h * 0.2, 2 * zoom, 4 * zoom);
      ctx.fillRect(x + leanX + w, y + bounceY + h * 0.2, 2 * zoom, 4 * zoom);
    }

    // Pernas alternando
    ctx.fillStyle = COLORS.pants;
    const legSwing = phase % 2 === 0 ? 1 : -1;
    ctx.fillRect(
      x + leanX + 2 * zoom + legSwing * zoom,
      y + bounceY + h * 0.75,
      3 * zoom,
      h * 0.25
    );
    ctx.fillRect(
      x + leanX + w - 5 * zoom - legSwing * zoom,
      y + bounceY + h * 0.75,
      3 * zoom,
      h * 0.25
    );

    // Notas musicais flutuando
    ctx.fillStyle = "#f1c40f";
    ctx.globalAlpha = 0.7;
    ctx.font = `${Math.max(6, 6 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    const notePhase = Math.floor(time * 3) % 4;
    const noteY1 = y + bounceY - (6 + notePhase * 2) * zoom;
    const noteY2 = y + bounceY - (10 + ((notePhase + 2) % 4) * 2) * zoom;
    ctx.fillText("♪", x + leanX - 2 * zoom, noteY1);
    ctx.fillStyle = "#e94560";
    ctx.fillText("♫", x + leanX + w + 4 * zoom, noteY2);
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
  }

  private drawWalkingCoffeeCharacter(
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
    // Corpo com bounce de caminhada
    const bounce = frame % 2 === 0 ? 0 : -1 * zoom;
    this.drawPixelBody(ctx, x, y + bounce, w, h, zoom, color);

    // Pernas andando
    const legSwing = frame % 2 === 0 ? 1 : -1;
    ctx.fillStyle = COLORS.pants;
    ctx.fillRect(x + 2 * zoom + legSwing * zoom, y + bounce + h * 0.75, 3 * zoom, h * 0.25);
    ctx.fillRect(x + w - 5 * zoom - legSwing * zoom, y + bounce + h * 0.75, 3 * zoom, h * 0.25);

    // Braco esquerdo balancando
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(x - 1 * zoom, y + h * 0.4 + legSwing * 2 * zoom + bounce, 2 * zoom, 4 * zoom);

    // Braco direito segurando cafe
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(x + w - 1 * zoom, y + h * 0.38 + bounce, 2 * zoom, 5 * zoom);

    // Copo de cafe na mao direita
    const cupX = x + w + 1 * zoom;
    const cupY = y + h * 0.35 + bounce;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cupX, cupY, 4 * zoom, 6 * zoom);
    ctx.fillStyle = COLORS.coffeeCup;
    ctx.fillRect(cupX + 0.5 * zoom, cupY + 1.5 * zoom, 3 * zoom, 4 * zoom);

    // Fumaca do cafe
    ctx.fillStyle = COLORS.steam;
    ctx.globalAlpha = 0.5;
    const steamOff = Math.floor(time * 2) % 3;
    ctx.fillRect(cupX + 1 * zoom, cupY - (2 + steamOff) * zoom, 1 * zoom, 1 * zoom);
    ctx.fillRect(cupX + 2.5 * zoom, cupY - (3 + steamOff) * zoom, 1 * zoom, 1 * zoom);
    ctx.globalAlpha = 1;
  }

  private drawWavingCharacter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom: number,
    color: string,
    frame: number,
    _time: number
  ): void {
    this.drawPixelBody(ctx, x, y, w, h, zoom, color);

    // Braco esquerdo normal
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(x - 1 * zoom, y + h * 0.4, 2 * zoom, 5 * zoom);

    // Braco direito acenando (sobe e desce)
    const wavePhase = frame % 4;
    const waveY = wavePhase < 2 ? -3 * zoom : -1 * zoom;
    const waveX = wavePhase === 1 || wavePhase === 3 ? 1 * zoom : 0;
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(x + w - 1 * zoom + waveX, y + h * 0.15 + waveY, 2 * zoom, 5 * zoom);

    // Mao aberta (retangulo maior no topo do braco)
    ctx.fillRect(x + w - 1.5 * zoom + waveX, y + h * 0.1 + waveY, 3 * zoom, 3 * zoom);

    // Texto "Hi!" flutuando
    if (frame % 4 < 3) {
      ctx.fillStyle = "#f1c40f";
      ctx.globalAlpha = 0.8;
      ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.fillText("Hi!", x + w + 4 * zoom, y + h * 0.05);
      ctx.textAlign = "start";
      ctx.globalAlpha = 1;
    }
  }

  private drawSittingFloorCharacter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    zoom: number,
    color: string,
    _frame: number
  ): void {
    // Sentado no chao — corpo mais baixo
    const sitY = y + h * 0.25;

    // Cabeca
    ctx.fillStyle = this.skinColor;
    const headSize = w * 0.6;
    const headX = x + (w - headSize) / 2;
    ctx.fillRect(headX, sitY, headSize, headSize);

    // Cabelo
    this.drawHairStyle(ctx, headX, sitY, headSize, zoom);

    // Olhos
    ctx.fillStyle = "#000000";
    ctx.fillRect(headX + 2 * zoom, sitY + 4 * zoom, 1.5 * zoom, 1.5 * zoom);
    ctx.fillRect(headX + headSize - 3.5 * zoom, sitY + 4 * zoom, 1.5 * zoom, 1.5 * zoom);

    // Corpo
    const bodyY = sitY + headSize + 1 * zoom;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1 * zoom, bodyY, w - 2 * zoom, h * 0.2);

    // Pernas esticadas para frente
    ctx.fillStyle = COLORS.pants;
    ctx.fillRect(x, bodyY + h * 0.2, w, h * 0.12);

    // Bracos apoiados no chao
    ctx.fillStyle = this.skinColor;
    ctx.fillRect(x - 2 * zoom, bodyY + h * 0.1, 3 * zoom, 3 * zoom);
    ctx.fillRect(x + w - 1 * zoom, bodyY + h * 0.1, 3 * zoom, 3 * zoom);
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
