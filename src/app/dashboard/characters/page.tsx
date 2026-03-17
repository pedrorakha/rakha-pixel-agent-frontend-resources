"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { COLORS, STATUS_COLORS, CHARACTER_WIDTH, CHARACTER_HEIGHT, ANIMATION_SPEEDS } from "@/lib/constants";
import { CharacterState } from "@/types/character";
import { DiscordStatus } from "@/types/discord";

const SPRITES = [
  { id: "char_01", name: "Agent Blue", shirt: "#3498db", hair: "#4a3728", skin: "#ffccaa" },
  { id: "char_02", name: "Agent Red", shirt: "#e74c3c", hair: "#2c3e50", skin: "#ffccaa" },
  { id: "char_03", name: "Agent Green", shirt: "#2ecc71", hair: "#d35400", skin: "#f5cba7" },
  { id: "char_04", name: "Agent Purple", shirt: "#9b59b6", hair: "#1a1a2e", skin: "#ffccaa" },
  { id: "char_05", name: "Agent Orange", shirt: "#f39c12", hair: "#7f8c8d", skin: "#fde3a7" },
  { id: "char_06", name: "Agent Teal", shirt: "#1abc9c", hair: "#8b4513", skin: "#ffccaa" },
];

type SpriteOption = (typeof SPRITES)[number];

const STATES: { state: CharacterState; label: string; discordStatus: DiscordStatus; description: string }[] = [
  { state: "typing", label: "TYPING", discordStatus: "online", description: "Online - Working at computer" },
  { state: "focused", label: "FOCUSED", discordStatus: "dnd", description: "DND - Wearing headphones, deep focus" },
  { state: "drinking_coffee", label: "COFFEE", discordStatus: "idle", description: "Idle - Taking a coffee break" },
  { state: "sleeping", label: "SLEEPING", discordStatus: "offline", description: "Offline - Resting in bed" },
  { state: "walking", label: "WALKING", discordStatus: "online", description: "Transitioning between areas" },
  { state: "idle", label: "IDLE", discordStatus: "online", description: "Standing still, waiting" },
];

export default function CharactersPage() {
  const [selectedSprite, setSelectedSprite] = useState(SPRITES[0]);
  const [previewState, setPreviewState] = useState<CharacterState>("typing");
  const [customShirt, setCustomShirt] = useState(SPRITES[0].shirt);
  const [customHair, setCustomHair] = useState(SPRITES[0].hair);
  const [customSkin, setCustomSkin] = useState(SPRITES[0].skin);

  const handleSpriteSelect = useCallback((sprite: SpriteOption) => {
    setSelectedSprite(sprite);
    setCustomShirt(sprite.shirt);
    setCustomHair(sprite.hair);
    setCustomSkin(sprite.skin);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-pixel text-sm text-pixel-accent">CHARACTERS</h1>
        <p className="font-pixel text-[7px] text-pixel-muted mt-1">
          Preview and customize character sprites
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Sprite selector */}
        <section className="bg-pixel-surface border-4 border-pixel-panel p-4">
          <h2 className="font-pixel text-[9px] text-pixel-text mb-4">CHOOSE CHARACTER</h2>
          <div className="grid grid-cols-2 gap-3">
            {SPRITES.map((sprite) => (
              <button
                key={sprite.id}
                onClick={() => handleSpriteSelect(sprite)}
                className={`
                  p-3 border-4 transition-all flex flex-col items-center gap-2
                  ${selectedSprite.id === sprite.id
                    ? "border-pixel-accent bg-pixel-accent/10"
                    : "border-pixel-panel hover:border-pixel-accent/50 bg-pixel-bg/50"
                  }
                `}
              >
                <MiniCharacterPreview shirt={sprite.shirt} hair={sprite.hair} skin={sprite.skin} />
                <span className="font-pixel text-[6px] text-pixel-muted">{sprite.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Center: Big animated preview */}
        <section className="bg-pixel-surface border-4 border-pixel-panel p-4 flex flex-col items-center">
          <h2 className="font-pixel text-[9px] text-pixel-text mb-4">PREVIEW</h2>

          <BigCharacterPreview
            shirt={customShirt}
            hair={customHair}
            skin={customSkin}
            state={previewState}
          />

          {/* State buttons */}
          <div className="grid grid-cols-3 gap-2 mt-4 w-full">
            {STATES.map((s) => (
              <button
                key={s.state}
                onClick={() => setPreviewState(s.state)}
                className={`
                  font-pixel text-[6px] px-2 py-2 border-2 transition-all text-center
                  ${previewState === s.state
                    ? "border-pixel-accent bg-pixel-accent/20 text-pixel-accent"
                    : "border-pixel-panel text-pixel-muted hover:text-pixel-text"
                  }
                `}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* State description */}
          <div className="mt-3 p-2 bg-pixel-bg/50 border-2 border-pixel-panel w-full">
            <p className="font-pixel text-[7px] text-pixel-text text-center">
              {STATES.find((s) => s.state === previewState)?.description}
            </p>
          </div>
        </section>

        {/* Right: Customization */}
        <section className="bg-pixel-surface border-4 border-pixel-panel p-4">
          <h2 className="font-pixel text-[9px] text-pixel-text mb-4">CUSTOMIZE COLORS</h2>

          <div className="flex flex-col gap-4">
            <ColorPicker
              label="SHIRT COLOR"
              value={customShirt}
              onChange={setCustomShirt}
              presets={["#3498db", "#e74c3c", "#2ecc71", "#9b59b6", "#f39c12", "#1abc9c", "#e67e22", "#2c3e50", "#c0392b", "#16a085"]}
            />

            <ColorPicker
              label="HAIR COLOR"
              value={customHair}
              onChange={setCustomHair}
              presets={["#4a3728", "#2c3e50", "#d35400", "#1a1a2e", "#7f8c8d", "#8b4513", "#f1c40f", "#c0392b", "#1a1a1a", "#daa520"]}
            />

            <ColorPicker
              label="SKIN TONE"
              value={customSkin}
              onChange={setCustomSkin}
              presets={["#ffccaa", "#f5cba7", "#fde3a7", "#d4a574", "#c68642", "#8d5524", "#ffdbac", "#f1c27d", "#e0ac69", "#6b4226"]}
            />

            <div className="border-t-2 border-pixel-panel/50 pt-4 mt-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  setCustomShirt(selectedSprite.shirt);
                  setCustomHair(selectedSprite.hair);
                  setCustomSkin(selectedSprite.skin);
                }}
              >
                RESET TO DEFAULT
              </Button>
            </div>
          </div>

          {/* Discord status legend */}
          <div className="mt-6 pt-4 border-t-2 border-pixel-panel/50">
            <h3 className="font-pixel text-[8px] text-pixel-muted mb-3">DISCORD STATUS MAP</h3>
            <div className="flex flex-col gap-2">
              {STATES.slice(0, 4).map((s) => (
                <div key={s.state} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[s.discordStatus] }}
                  />
                  <span className="font-pixel text-[6px] text-pixel-muted flex-1">
                    {s.discordStatus.toUpperCase()}
                  </span>
                  <span className="font-pixel text-[6px] text-pixel-text">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Sub-components ---

function MiniCharacterPreview({ shirt, hair, skin }: { shirt: string; hair: string; skin: string }) {
  return (
    <div className="w-8 h-12 relative" style={{ imageRendering: "pixelated" }}>
      {/* Head */}
      <div className="absolute top-0 left-1.5 w-5 h-5" style={{ backgroundColor: skin }} />
      {/* Hair */}
      <div className="absolute top-0 left-1.5 w-5 h-1.5" style={{ backgroundColor: hair }} />
      {/* Eyes */}
      <div className="absolute top-[7px] left-[8px] w-1 h-1 bg-black" />
      <div className="absolute top-[7px] left-[15px] w-1 h-1 bg-black" />
      {/* Body */}
      <div className="absolute top-[22px] left-0.5 w-7 h-4" style={{ backgroundColor: shirt }} />
      {/* Pants */}
      <div className="absolute top-[38px] left-0.5 w-7 h-2.5 bg-[#2c3e50]" />
    </div>
  );
}

function BigCharacterPreview({
  shirt,
  hair,
  skin,
  state,
}: {
  shirt: string;
  hair: string;
  skin: string;
  state: CharacterState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 160;
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;

    let animId: number;
    let lastTime = 0;

    const zoom = 5;
    const cw = CHARACTER_WIDTH * zoom * 0.5;
    const ch = CHARACTER_HEIGHT * zoom * 0.5;
    const cx = (size - cw) / 2;
    const cy = (size - ch) / 2 - 10;

    const draw = (time: number) => {
      const dt = time - lastTime;
      timerRef.current += dt;
      lastTime = time;

      const speed = ANIMATION_SPEEDS[state];
      if (timerRef.current > speed) {
        frameRef.current = (frameRef.current + 1) % 4;
        timerRef.current = 0;
      }

      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#0f0f1a";
      ctx.fillRect(0, 0, size, size);

      // Floor shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(size / 2, cy + ch + 4, cw * 0.6, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      const frame = frameRef.current;

      // Draw character
      drawCharacter(ctx, cx, cy, cw, ch, zoom, shirt, hair, skin, state, frame, time / 1000);

      // State label
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `8px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.fillText(state.toUpperCase().replace("_", " "), size / 2, size - 8);
      ctx.textAlign = "start";

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [shirt, hair, skin, state]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={160}
      className="border-4 border-pixel-panel"
    />
  );
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  zoom: number, shirt: string, hair: string, skin: string,
  state: CharacterState, frame: number, time: number
) {
  const bounce = (state === "walking" || state === "drinking_coffee") && frame % 2 !== 0 ? -2 : 0;
  const dy = y + bounce;

  // Head
  const headSize = w * 0.65;
  const headX = x + (w - headSize) / 2;
  ctx.fillStyle = skin;
  ctx.fillRect(headX, dy, headSize, headSize);

  // Hair
  ctx.fillStyle = hair;
  ctx.fillRect(headX, dy, headSize, headSize * 0.25);
  // Side hair
  ctx.fillRect(headX, dy, 3, headSize * 0.5);
  ctx.fillRect(headX + headSize - 3, dy, 3, headSize * 0.5);

  // Eyes
  if (state === "sleeping") {
    ctx.fillStyle = "#000";
    ctx.fillRect(headX + headSize * 0.2, dy + headSize * 0.5, headSize * 0.15, 1);
    ctx.fillRect(headX + headSize * 0.65, dy + headSize * 0.5, headSize * 0.15, 1);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(headX + headSize * 0.2, dy + headSize * 0.4, 3, 3);
    ctx.fillRect(headX + headSize * 0.65, dy + headSize * 0.4, 3, 3);
    // Eye highlight
    ctx.fillStyle = "#fff";
    ctx.fillRect(headX + headSize * 0.2 + 1, dy + headSize * 0.4, 1, 1);
    ctx.fillRect(headX + headSize * 0.65 + 1, dy + headSize * 0.4, 1, 1);
  }

  // Mouth
  if (state === "drinking_coffee") {
    ctx.fillStyle = "#000";
    ctx.fillRect(headX + headSize * 0.4, dy + headSize * 0.7, headSize * 0.2, 2);
  }

  // Body
  const bodyY = dy + headSize + 2;
  const bodyH = h * 0.35;
  ctx.fillStyle = shirt;
  ctx.fillRect(x + 3, bodyY, w - 6, bodyH);
  // Shirt shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(x + 3, bodyY + bodyH - 4, w - 6, 4);

  // Pants
  ctx.fillStyle = COLORS.pants;
  const pantsY = bodyY + bodyH;
  ctx.fillRect(x + 3, pantsY, w - 6, h * 0.18);

  // Feet
  ctx.fillStyle = "#1a1a1a";
  const feetY = pantsY + h * 0.18;
  if (state === "walking") {
    const legSwing = frame % 2 === 0 ? 2 : -2;
    ctx.fillRect(x + 4 + legSwing, feetY, (w - 8) / 2 - 1, 4);
    ctx.fillRect(x + w / 2 + 1 - legSwing, feetY, (w - 8) / 2 - 1, 4);
  } else {
    ctx.fillRect(x + 4, feetY, (w - 8) / 2 - 1, 3);
    ctx.fillRect(x + w / 2 + 1, feetY, (w - 8) / 2 - 1, 3);
  }

  // State-specific details
  switch (state) {
    case "typing": {
      const armOff = frame % 2 === 0 ? 0 : -3;
      ctx.fillStyle = skin;
      ctx.fillRect(x - 3, bodyY + 4 + armOff, 5, 8);
      ctx.fillRect(x + w - 2, bodyY + 4 - armOff, 5, 8);
      break;
    }
    case "focused": {
      ctx.fillStyle = COLORS.headphones;
      ctx.fillRect(headX - 3, dy - 2, headSize + 6, 4);
      ctx.fillStyle = COLORS.headphonesAccent;
      ctx.fillRect(headX - 5, dy + 4, 6, 8);
      ctx.fillRect(headX + headSize - 1, dy + 4, 6, 8);
      // Arms resting
      ctx.fillStyle = skin;
      ctx.fillRect(x - 2, bodyY + 6, 4, 8);
      ctx.fillRect(x + w - 2, bodyY + 6, 4, 8);
      break;
    }
    case "drinking_coffee": {
      // Left arm
      ctx.fillStyle = skin;
      ctx.fillRect(x - 2, bodyY + 4 + bounce, 4, 8);
      // Right arm holding cup
      ctx.fillRect(x + w - 2, bodyY + 2 + bounce, 4, 10);
      // Cup
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + w + 2, bodyY + 4 + bounce, 8, 10);
      ctx.fillStyle = COLORS.coffeeCup;
      ctx.fillRect(x + w + 3, bodyY + 6 + bounce, 6, 7);
      // Steam
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      const so = Math.floor(time * 2) % 3;
      ctx.fillRect(x + w + 4, bodyY - 2 - so * 3 + bounce, 2, 2);
      ctx.fillRect(x + w + 7, bodyY - 4 - so * 3 + bounce, 2, 2);
      break;
    }
    case "sleeping": {
      // Zzz
      ctx.fillStyle = COLORS.zzz;
      ctx.font = `10px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      const zo = Math.floor(time * 1.5) % 3;
      ctx.globalAlpha = 0.8 - zo * 0.2;
      ctx.fillText("z", x + w + 8, dy - 4 - zo * 6);
      if (zo > 0) {
        ctx.globalAlpha = 0.5;
        ctx.fillText("Z", x + w + 14, dy - 12 - zo * 4);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
      // Arms tucked
      ctx.fillStyle = skin;
      ctx.fillRect(x + 1, bodyY + 6, 3, 6);
      ctx.fillRect(x + w - 4, bodyY + 6, 3, 6);
      break;
    }
    case "walking": {
      // Swinging arms
      const armSwing = frame % 2 === 0 ? 3 : -3;
      ctx.fillStyle = skin;
      ctx.fillRect(x - 2, bodyY + 4 + armSwing, 4, 8);
      ctx.fillRect(x + w - 2, bodyY + 4 - armSwing, 4, 8);
      break;
    }
    case "idle": {
      ctx.fillStyle = skin;
      ctx.fillRect(x - 2, bodyY + 6, 4, 8);
      ctx.fillRect(x + w - 2, bodyY + 6, 4, 8);
      break;
    }
  }
}

function ColorPicker({
  label,
  value,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="font-pixel text-[8px] text-pixel-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 border-2 border-pixel-panel cursor-pointer bg-transparent"
        />
        <span className="font-pixel text-[8px] text-pixel-text">{value}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-5 h-5 border-2 transition-all ${value === color ? "border-pixel-accent scale-110" : "border-pixel-panel/50 hover:border-pixel-accent/50"}`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}
