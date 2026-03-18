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
    footprints?: Footprint[]
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
      this.renderRoomFurniture(ctx, state, rf);
    }

    // Layer 2.5: Meeting room furniture
    this.renderMeetingRoom(ctx, state);

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

  private renderMeetingRoom(
    ctx: CanvasRenderingContext2D,
    state: GameState
  ): void {
    const room = ROOMS[MEETING_ROOM_INDEX];
    if (!room) return;

    const zoom = state.camera.zoom;
    const ts = TILE_SIZE * zoom;

    // Mesa de reuniao grande no centro (9 wide x 14 tall)
    const tableW = 9;
    const tableH = 14;
    const tableX = room.x + Math.floor((room.w - tableW) / 2);
    const tableY = room.y + Math.floor((room.h - tableH) / 2);
    const { x: sx, y: sy } = this.worldToScreen(state, tableX * TILE_SIZE, tableY * TILE_SIZE);
    const tw = tableW * ts;
    const th = tableH * ts;

    // Mesa
    ctx.fillStyle = COLORS.desk;
    ctx.fillRect(sx, sy, tw, th);
    // Borda clara no topo
    ctx.fillStyle = COLORS.deskLight;
    ctx.fillRect(sx + zoom, sy + zoom, tw - 2 * zoom, 3 * zoom);
    // Borda escura embaixo
    ctx.fillStyle = COLORS.deskDark;
    ctx.fillRect(sx, sy + th - 3 * zoom, tw, 3 * zoom);
    // Interior da mesa (mais claro)
    ctx.fillStyle = "#9a7420";
    ctx.fillRect(sx + 3 * zoom, sy + 4 * zoom, tw - 6 * zoom, th - 7 * zoom);

    // Cadeiras ao redor
    const chairColor = COLORS.chair;
    const chairW = 2 * ts;
    const chairH = 1.5 * ts;

    // Cadeiras no topo (4)
    for (let i = 0; i < 4; i++) {
      const cx = sx + (0.5 + i * 2.1) * ts;
      const cy = sy - chairH - 1 * zoom;
      ctx.fillStyle = chairColor;
      ctx.fillRect(cx, cy, chairW, chairH);
      ctx.fillStyle = COLORS.chairSeat;
      ctx.fillRect(cx + zoom, cy + zoom, chairW - 2 * zoom, chairH - 2 * zoom);
    }

    // Cadeiras embaixo (4)
    for (let i = 0; i < 4; i++) {
      const cx = sx + (0.5 + i * 2.1) * ts;
      const cy = sy + th + 1 * zoom;
      ctx.fillStyle = chairColor;
      ctx.fillRect(cx, cy, chairW, chairH);
      ctx.fillStyle = COLORS.chairSeat;
      ctx.fillRect(cx + zoom, cy + zoom, chairW - 2 * zoom, chairH - 2 * zoom);
    }

    // Cadeiras na esquerda (5)
    for (let i = 0; i < 5; i++) {
      const cx = sx - chairH - 1 * zoom;
      const cy = sy + (0.5 + i * 2.6) * ts;
      ctx.fillStyle = chairColor;
      ctx.fillRect(cx, cy, chairH, chairW);
      ctx.fillStyle = COLORS.chairSeat;
      ctx.fillRect(cx + zoom, cy + zoom, chairH - 2 * zoom, chairW - 2 * zoom);
    }

    // Cadeiras na direita (5)
    for (let i = 0; i < 5; i++) {
      const cx = sx + tw + 1 * zoom;
      const cy = sy + (0.5 + i * 2.6) * ts;
      ctx.fillStyle = chairColor;
      ctx.fillRect(cx, cy, chairH, chairW);
      ctx.fillStyle = COLORS.chairSeat;
      ctx.fillRect(cx + zoom, cy + zoom, chairH - 2 * zoom, chairW - 2 * zoom);
    }

    // Planta decorativa no canto superior direito
    const plantX = room.x + room.w - 2;
    const plantY = room.y + 1;
    const { x: px, y: py } = this.worldToScreen(state, plantX * TILE_SIZE, plantY * TILE_SIZE);
    ctx.fillStyle = COLORS.plantPot;
    ctx.fillRect(px + 3 * zoom, py + 8 * zoom, 10 * zoom, 6 * zoom);
    ctx.fillStyle = COLORS.plant;
    ctx.fillRect(px + 4 * zoom, py + 2 * zoom, 4 * zoom, 6 * zoom);
    ctx.fillRect(px + 8 * zoom, py + 3 * zoom, 4 * zoom, 5 * zoom);

    // Planta no canto inferior esquerdo
    const plant2X = room.x + 1;
    const plant2Y = room.y + room.h - 2;
    const { x: p2x, y: p2y } = this.worldToScreen(state, plant2X * TILE_SIZE, plant2Y * TILE_SIZE);
    ctx.fillStyle = COLORS.plantPot;
    ctx.fillRect(p2x + 3 * zoom, p2y + 8 * zoom, 10 * zoom, 6 * zoom);
    ctx.fillStyle = COLORS.plant;
    ctx.fillRect(p2x + 4 * zoom, p2y + 2 * zoom, 4 * zoom, 6 * zoom);
    ctx.fillRect(p2x + 8 * zoom, p2y + 3 * zoom, 4 * zoom, 5 * zoom);

    // Label "MEETING ROOM"
    const labelX = room.x + room.w / 2;
    const labelY = room.y + room.h - 1;
    const { x: lx, y: ly } = this.worldToScreen(state, labelX * TILE_SIZE, labelY * TILE_SIZE);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = `${Math.max(5, 5 * zoom)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("MEETING ROOM", lx, ly);
    ctx.textAlign = "start";
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
      case "dancing":
        this.drawDancingCharacter(ctx, cx, cy, cw, ch, zoom, character.color, animFrame, state.time);
        break;
      case "walking_coffee":
        this.drawWalkingCoffeeCharacter(ctx, cx, cy, cw, ch, zoom, character.color, animFrame, state.time);
        break;
      case "waving":
        this.drawWavingCharacter(ctx, cx, cy, cw, ch, zoom, character.color, animFrame, state.time);
        break;
      case "sitting_floor":
        this.drawSittingFloorCharacter(ctx, cx, cy, cw, ch, zoom, character.color, animFrame);
        break;
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

    // Accessories — draw on top of character
    if (character.hat && character.hat !== "none" && charState !== "sleeping") {
      this.drawHat(ctx, accHeadX, accHeadY, headSize, zoom, character.hat);
    }

    if (character.glasses && character.glasses !== "none" && charState !== "sleeping") {
      this.drawGlasses(ctx, accHeadX, accHeadY, headSize, zoom, character.glasses);
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
    // Head
    ctx.fillStyle = this.skinColor;
    const headSize = w * 0.6;
    const headX = x + (w - headSize) / 2;
    ctx.fillRect(headX, y, headSize, headSize);

    // Hair
    this.drawHairStyle(ctx, headX, y, headSize, zoom);

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
