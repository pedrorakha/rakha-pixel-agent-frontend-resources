"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AccessoryHat, AccessoryGlasses, HairStyle } from "@/types/character";
import { COLORS, CHARACTER_WIDTH, CHARACTER_HEIGHT } from "@/lib/constants";
import { api } from "@/lib/api";

interface VisualEditorProps {
  memberId: string;
  initialHat: AccessoryHat;
  initialGlasses: AccessoryGlasses;
  initialHairStyle: HairStyle;
  initialColorShirt: string;
  initialColorHair: string;
  initialColorSkin: string;
  onClose: () => void;
  onSave: (data: VisualData) => void;
}

export interface VisualData {
  accessory_hat: AccessoryHat;
  accessory_glasses: AccessoryGlasses;
  hair_style: HairStyle;
  color_shirt: string;
  color_hair: string;
  color_skin: string;
}

const HAT_OPTIONS: { value: AccessoryHat; label: string; icon: string }[] = [
  { value: "none", label: "Nenhum", icon: "🚫" },
  { value: "cap", label: "Boné", icon: "🧢" },
  { value: "beanie", label: "Gorro", icon: "🎿" },
  { value: "tophat", label: "Cartola", icon: "🎩" },
  { value: "crown", label: "Coroa", icon: "👑" },
  { value: "headband", label: "Faixa", icon: "🏋️" },
  { value: "witch", label: "Bruxa", icon: "🧙" },
  { value: "santa", label: "Natal", icon: "🎅" },
  { value: "beret", label: "Boina", icon: "🇫🇷" },
  { value: "cowboy", label: "Cowboy", icon: "🤠" },
];

const GLASSES_OPTIONS: { value: AccessoryGlasses; label: string; icon: string }[] = [
  { value: "none", label: "Nenhum", icon: "🚫" },
  { value: "round", label: "Redondo", icon: "👓" },
  { value: "square", label: "Quadrado", icon: "🤓" },
  { value: "sunglasses", label: "Escuros", icon: "🕶️" },
  { value: "monocle", label: "Monóculo", icon: "🧐" },
  { value: "aviator", label: "Aviador", icon: "✈️" },
  { value: "pixel", label: "Pixel", icon: "🎮" },
  { value: "heart", label: "Coração", icon: "❤️" },
];

const HAIR_OPTIONS: { value: HairStyle; label: string; icon: string }[] = [
  { value: "short", label: "Curto", icon: "✂️" },
  { value: "buzz", label: "Raspado", icon: "💈" },
  { value: "spiky", label: "Espetado", icon: "⚡" },
  { value: "messy", label: "Bagunçado", icon: "🌪️" },
  { value: "long_straight", label: "Longo liso", icon: "💇" },
  { value: "long_wavy", label: "Ondulado", icon: "🌊" },
  { value: "ponytail", label: "Rabo", icon: "🎀" },
  { value: "pigtails", label: "M. chiquinha", icon: "🎗️" },
  { value: "mohawk", label: "Moicano", icon: "🤘" },
  { value: "bald", label: "Careca", icon: "🥚" },
  { value: "afro", label: "Afro", icon: "🌺" },
  { value: "bob", label: "Chanel", icon: "💅" },
];

const SKIN_PRESETS = ["#ffccaa", "#f5c6a3", "#e8b090", "#c68642", "#8d5524", "#6b3e26", "#fde7d6", "#d4a57b"];
const HAIR_COLOR_PRESETS = ["#4a3728", "#1a1a2e", "#c0392b", "#f39c12", "#ecf0f1", "#8e44ad", "#e67e22", "#2c3e50", "#27ae60", "#e91e63"];
const SHIRT_PRESETS = ["#3498db", "#e74c3c", "#2ecc71", "#9b59b6", "#f39c12", "#1abc9c", "#e91e63", "#34495e", "#ff6b6b", "#00d2d3"];

// Mini preview canvas do personagem
function CharacterMiniPreview({
  hat, glasses, hairStyle, colorShirt, colorHair, colorSkin,
}: {
  hat: string; glasses: string; hairStyle: string;
  colorShirt: string; colorHair: string; colorSkin: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 64, H = 80, z = 3.5;
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;

    let animId: number;
    let lastTime = 0;

    const draw = (time: number) => {
      const dt = time - lastTime;
      timerRef.current += dt;
      lastTime = time;
      if (timerRef.current > 250) {
        frameRef.current = (frameRef.current + 1) % 4;
        timerRef.current = 0;
      }

      ctx.clearRect(0, 0, W, H);

      const cx = 14, cy = 12;
      const cw = CHARACTER_WIDTH * z * 0.7;
      const ch = CHARACTER_HEIGHT * z * 0.7;
      const headSize = cw * 0.65;
      const headX = cx + (cw - headSize) / 2;

      // Head
      ctx.fillStyle = colorSkin;
      ctx.fillRect(headX, cy, headSize, headSize);

      // Hair
      drawMiniHair(ctx, headX, cy, headSize, z, hairStyle, colorHair);

      // Eyes
      ctx.fillStyle = "#000";
      ctx.fillRect(headX + z * 1, cy + headSize * 0.4, z * 0.7, z * 0.7);
      ctx.fillRect(headX + headSize - z * 1.7, cy + headSize * 0.4, z * 0.7, z * 0.7);

      // Body
      const bodyY = cy + headSize + z * 0.3;
      ctx.fillStyle = colorShirt;
      ctx.fillRect(cx + z * 0.5, bodyY, cw - z * 1, ch * 0.35);

      // Pants
      ctx.fillStyle = COLORS.pants;
      ctx.fillRect(cx + z * 0.5, bodyY + ch * 0.35, cw - z * 1, ch * 0.2);

      // Arms typing
      const armOff = frameRef.current % 2 === 0 ? 0 : -z * 0.7;
      ctx.fillStyle = colorSkin;
      ctx.fillRect(cx - z * 0.5, bodyY + z * 0.5 + armOff, z * 0.8, z * 2);
      ctx.fillRect(cx + cw - z * 0.3, bodyY + z * 0.5 - armOff, z * 0.8, z * 2);

      // Hat
      if (hat !== "none") drawMiniHat(ctx, headX, cy, headSize, z, hat);
      // Glasses
      if (glasses !== "none") drawMiniGlasses(ctx, headX, cy, headSize, z, glasses);

      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [hat, glasses, hairStyle, colorShirt, colorHair, colorSkin]);

  return <canvas ref={canvasRef} width={64} height={80} className="border-2 border-pixel-panel" />;
}

function drawMiniHair(ctx: CanvasRenderingContext2D, hx: number, hy: number, hs: number, z: number, style: string, color: string) {
  ctx.fillStyle = color;
  switch (style) {
    case "bald": break;
    case "buzz":
      ctx.globalAlpha = 0.5;
      ctx.fillRect(hx, hy, hs, z * 0.8);
      ctx.globalAlpha = 1;
      break;
    case "spiky":
      ctx.fillRect(hx, hy, hs, z * 0.8);
      for (let sx = hx; sx < hx + hs - 1; sx += z * 1.2) {
        ctx.fillRect(sx, hy - z * 0.8, z * 0.8, z * 0.8);
      }
      break;
    case "messy":
      ctx.fillRect(hx, hy, hs, z * 1);
      ctx.fillRect(hx - z * 0.3, hy + z * 0.3, z * 0.7, z * 0.7);
      ctx.fillRect(hx + hs - z * 0.3, hy, z * 0.7, z * 0.7);
      break;
    case "long_straight":
      ctx.fillRect(hx, hy, hs, z * 1);
      ctx.fillRect(hx - z * 0.5, hy + z * 0.3, z * 0.7, hs + z * 1.5);
      ctx.fillRect(hx + hs - z * 0.2, hy + z * 0.3, z * 0.7, hs + z * 1.5);
      break;
    case "long_wavy":
      ctx.fillRect(hx, hy, hs, z * 1);
      ctx.fillRect(hx - z * 0.7, hy + z * 0.3, z * 0.8, hs + z * 1);
      ctx.fillRect(hx + hs - z * 0.1, hy + z * 0.3, z * 0.8, hs + z * 1);
      ctx.fillRect(hx - z * 0.4, hy + hs + z * 0.5, z * 0.6, z * 1);
      ctx.fillRect(hx + hs + z * 0.1, hy + hs + z * 0.5, z * 0.6, z * 1);
      break;
    case "ponytail":
      ctx.fillRect(hx, hy, hs, z * 1);
      ctx.fillRect(hx + hs, hy + z * 0.7, z * 0.7, z * 0.7);
      ctx.fillRect(hx + hs + z * 0.3, hy + z * 1, z * 0.7, z * 1.5);
      break;
    case "pigtails":
      ctx.fillRect(hx, hy, hs, z * 1);
      ctx.fillRect(hx - z * 0.7, hy + z * 0.7, z * 0.7, z * 2);
      ctx.fillRect(hx + hs, hy + z * 0.7, z * 0.7, z * 2);
      break;
    case "mohawk": {
      const mw = z * 1;
      ctx.fillRect(hx + (hs - mw) / 2, hy - z * 1.3, mw, z * 1.3 + z * 0.7);
      ctx.globalAlpha = 0.3;
      ctx.fillRect(hx, hy, hs, z * 0.7);
      ctx.globalAlpha = 1;
      break;
    }
    case "afro":
      ctx.beginPath();
      ctx.arc(hx + hs / 2, hy + hs * 0.3, hs / 2 + z * 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffccaa";
      ctx.fillRect(hx + z * 0.3, hy + z * 0.7, hs - z * 0.6, hs - z * 0.7);
      break;
    case "bob":
      ctx.fillRect(hx - z * 0.3, hy, hs + z * 0.6, z * 1);
      ctx.fillRect(hx - z * 0.5, hy + z * 0.3, z * 0.8, hs - z * 0.3);
      ctx.fillRect(hx + hs - z * 0.3, hy + z * 0.3, z * 0.8, hs - z * 0.3);
      break;
    default: // short
      ctx.fillRect(hx, hy, hs, z * 1);
      break;
  }
}

function drawMiniHat(ctx: CanvasRenderingContext2D, hx: number, hy: number, hs: number, z: number, hat: string) {
  switch (hat) {
    case "cap":
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(hx - z * 0.3, hy - z * 1, hs + z * 0.6, z * 1.2);
      ctx.fillStyle = "#a93226";
      ctx.fillRect(hx - z * 0.6, hy - z * 0.1, hs * 0.6, z * 0.6);
      break;
    case "beanie":
      ctx.fillStyle = "#8e44ad";
      ctx.fillRect(hx - z * 0.3, hy - z * 1.3, hs + z * 0.6, z * 1.5);
      ctx.fillStyle = "#7d3c98";
      ctx.fillRect(hx - z * 0.3, hy - z * 0.3, hs + z * 0.6, z * 0.6);
      ctx.fillStyle = "#f1c40f";
      ctx.fillRect(hx + hs / 2 - z * 0.5, hy - z * 2, z * 1, z * 1);
      break;
    case "tophat":
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(hx - z * 0.5, hy - z * 0.5, hs + z * 1, z * 0.6);
      ctx.fillRect(hx + z * 0.2, hy - z * 2.5, hs - z * 0.4, z * 2.2);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(hx + z * 0.2, hy - z * 1.2, hs - z * 0.4, z * 0.4);
      break;
    case "crown":
      ctx.fillStyle = "#f1c40f";
      ctx.fillRect(hx - z * 0.3, hy - z * 0.6, hs + z * 0.6, z * 0.8);
      ctx.fillRect(hx, hy - z * 1.5, z * 0.6, z * 1);
      ctx.fillRect(hx + hs / 2 - z * 0.3, hy - z * 1.8, z * 0.6, z * 1.3);
      ctx.fillRect(hx + hs - z * 0.6, hy - z * 1.5, z * 0.6, z * 1);
      break;
    case "headband":
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(hx - z * 0.3, hy + z * 0.3, hs + z * 0.6, z * 0.6);
      break;
    case "witch":
      ctx.fillStyle = "#2d1b69";
      ctx.fillRect(hx - z * 1, hy - z * 0.3, hs + z * 2, z * 0.6);
      ctx.fillRect(hx, hy - z * 1.6, hs, z * 1.3);
      ctx.fillRect(hx + z * 0.3, hy - z * 2.5, hs - z * 0.6, z * 1);
      ctx.fillStyle = "#f39c12";
      ctx.fillRect(hx, hy - z * 0.9, hs, z * 0.4);
      break;
    case "santa":
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(hx - z * 0.3, hy - z * 0.6, hs + z * 0.6, z * 1.2);
      ctx.fillRect(hx + z * 0.3, hy - z * 1.6, hs - z * 0.6, z * 1);
      ctx.fillStyle = "#ecf0f1";
      ctx.fillRect(hx - z * 0.3, hy + z * 0.2, hs + z * 0.6, z * 0.6);
      ctx.fillRect(hx + hs - z * 1, hy - z * 2.2, z * 1, z * 1);
      break;
    case "beret":
      ctx.fillStyle = "#2c3e50";
      ctx.fillRect(hx - z * 0.5, hy - z * 0.6, hs + z * 1, z * 1);
      ctx.fillRect(hx - z * 0.3, hy - z * 1.2, hs + z * 0.6, z * 0.6);
      break;
    case "cowboy":
      ctx.fillStyle = "#8B4513";
      ctx.fillRect(hx - z * 1.2, hy - z * 0.3, hs + z * 2.4, z * 0.6);
      ctx.fillRect(hx, hy - z * 1.6, hs, z * 1.3);
      ctx.fillStyle = "#d4a574";
      ctx.fillRect(hx, hy - z * 0.9, hs, z * 0.4);
      break;
  }
}

function drawMiniGlasses(ctx: CanvasRenderingContext2D, hx: number, hy: number, hs: number, z: number, glasses: string) {
  const eyeY = hy + hs * 0.35;
  switch (glasses) {
    case "round":
      ctx.strokeStyle = "#333";
      ctx.lineWidth = z * 0.25;
      ctx.beginPath();
      ctx.arc(hx + z * 0.8, eyeY + z * 0.3, z * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx + hs - z * 0.8, eyeY + z * 0.3, z * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "square":
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = z * 0.25;
      ctx.strokeRect(hx + z * 0.2, eyeY - z * 0.1, z * 1.2, z * 0.9);
      ctx.strokeRect(hx + hs - z * 1.4, eyeY - z * 0.1, z * 1.2, z * 0.9);
      break;
    case "sunglasses":
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(hx + z * 0.2, eyeY - z * 0.1, z * 1.2, z * 0.9);
      ctx.fillRect(hx + hs - z * 1.4, eyeY - z * 0.1, z * 1.2, z * 0.9);
      break;
    case "monocle":
      ctx.strokeStyle = "#c0a030";
      ctx.lineWidth = z * 0.25;
      ctx.beginPath();
      ctx.arc(hx + hs - z * 0.8, eyeY + z * 0.3, z * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "aviator":
      ctx.fillStyle = "rgba(139,90,43,0.6)";
      ctx.fillRect(hx + z * 0.2, eyeY - z * 0.2, z * 1.3, z * 1.2);
      ctx.fillRect(hx + hs - z * 1.5, eyeY - z * 0.2, z * 1.3, z * 1.2);
      ctx.strokeStyle = "#c0a030";
      ctx.lineWidth = z * 0.2;
      ctx.strokeRect(hx + z * 0.2, eyeY - z * 0.2, z * 1.3, z * 1.2);
      ctx.strokeRect(hx + hs - z * 1.5, eyeY - z * 0.2, z * 1.3, z * 1.2);
      break;
    case "pixel":
      ctx.fillStyle = "#000";
      ctx.fillRect(hx + z * 0.2, eyeY - z * 0.1, z * 1.3, z * 0.9);
      ctx.fillRect(hx + hs - z * 1.5, eyeY - z * 0.1, z * 1.3, z * 0.9);
      ctx.fillRect(hx + z * 1.5, eyeY + z * 0.1, hs - z * 3, z * 0.4);
      break;
    case "heart":
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.arc(hx + z * 0.6, eyeY + z * 0.1, z * 0.5, 0, Math.PI * 2);
      ctx.arc(hx + z * 1.2, eyeY + z * 0.1, z * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx + hs - z * 1.2, eyeY + z * 0.1, z * 0.5, 0, Math.PI * 2);
      ctx.arc(hx + hs - z * 0.6, eyeY + z * 0.1, z * 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

export function VisualEditor({
  memberId,
  initialHat,
  initialGlasses,
  initialHairStyle,
  initialColorShirt,
  initialColorHair,
  initialColorSkin,
  onClose,
  onSave,
}: VisualEditorProps) {
  const [hat, setHat] = useState<AccessoryHat>(initialHat);
  const [glasses, setGlasses] = useState<AccessoryGlasses>(initialGlasses);
  const [hairStyle, setHairStyle] = useState<HairStyle>(initialHairStyle);
  const [colorShirt, setColorShirt] = useState(initialColorShirt);
  const [colorHair, setColorHair] = useState(initialColorHair);
  const [colorSkin, setColorSkin] = useState(initialColorSkin);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"hair" | "hat" | "glasses" | "colors">("hair");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const data: VisualData = {
        accessory_hat: hat,
        accessory_glasses: glasses,
        hair_style: hairStyle,
        color_shirt: colorShirt,
        color_hair: colorHair,
        color_skin: colorSkin,
      };
      await api.patch(`/members/${memberId}`, data);
      onSave(data);
      onClose();
    } catch (err) {
      console.error("Failed to save visual:", err);
    } finally {
      setSaving(false);
    }
  }, [memberId, hat, glasses, hairStyle, colorShirt, colorHair, colorSkin, onSave, onClose]);

  const tabs = [
    { key: "hair" as const, label: "CABELO" },
    { key: "hat" as const, label: "CHAPÉU" },
    { key: "glasses" as const, label: "ÓCULOS" },
    { key: "colors" as const, label: "CORES" },
  ];

  return (
    <div ref={panelRef} className="bg-pixel-surface border-2 border-pixel-accent shadow-lg w-[360px] max-h-[460px] flex flex-col">
      {/* Header com preview */}
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-pixel-panel">
        <div className="flex items-center gap-3">
          <CharacterMiniPreview
            hat={hat}
            glasses={glasses}
            hairStyle={hairStyle}
            colorShirt={colorShirt}
            colorHair={colorHair}
            colorSkin={colorSkin}
          />
          <span className="font-pixel text-[9px] text-pixel-accent">PERSONALIZAR</span>
        </div>
        <button onClick={onClose} className="font-pixel text-[10px] text-pixel-muted hover:text-pixel-text">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-pixel-panel">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-1.5 font-pixel text-[7px] transition-colors ${
              activeTab === t.key
                ? "bg-pixel-accent/20 text-pixel-accent border-b-2 border-pixel-accent -mb-[2px]"
                : "text-pixel-muted hover:text-pixel-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {activeTab === "hair" && (
          <div className="grid grid-cols-4 gap-1.5">
            {HAIR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHairStyle(opt.value)}
                className={`flex flex-col items-center gap-0.5 px-1 py-1.5 border-2 transition-colors ${
                  hairStyle === opt.value
                    ? "border-pixel-accent bg-pixel-accent/20 text-pixel-accent"
                    : "border-pixel-panel text-pixel-muted hover:border-pixel-accent/50"
                }`}
              >
                <span className="text-sm">{opt.icon}</span>
                <span className="font-pixel text-[6px] leading-tight text-center">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {activeTab === "hat" && (
          <div className="grid grid-cols-4 gap-1.5">
            {HAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHat(opt.value)}
                className={`flex flex-col items-center gap-0.5 px-1 py-1.5 border-2 transition-colors ${
                  hat === opt.value
                    ? "border-pixel-accent bg-pixel-accent/20 text-pixel-accent"
                    : "border-pixel-panel text-pixel-muted hover:border-pixel-accent/50"
                }`}
              >
                <span className="text-sm">{opt.icon}</span>
                <span className="font-pixel text-[6px] leading-tight text-center">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {activeTab === "glasses" && (
          <div className="grid grid-cols-4 gap-1.5">
            {GLASSES_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGlasses(opt.value)}
                className={`flex flex-col items-center gap-0.5 px-1 py-1.5 border-2 transition-colors ${
                  glasses === opt.value
                    ? "border-pixel-accent bg-pixel-accent/20 text-pixel-accent"
                    : "border-pixel-panel text-pixel-muted hover:border-pixel-accent/50"
                }`}
              >
                <span className="text-sm">{opt.icon}</span>
                <span className="font-pixel text-[6px] leading-tight text-center">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {activeTab === "colors" && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-pixel text-[7px] text-pixel-muted mb-1.5">PELE</p>
              <div className="flex flex-wrap gap-1.5">
                {SKIN_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColorSkin(c)}
                    className={`w-6 h-6 border-2 transition-colors ${
                      colorSkin === c ? "border-pixel-accent scale-110" : "border-pixel-panel hover:border-pixel-accent/50"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input type="color" value={colorSkin} onChange={(e) => setColorSkin(e.target.value)}
                  className="w-6 h-6 cursor-pointer border-2 border-pixel-panel" />
              </div>
            </div>
            <div>
              <p className="font-pixel text-[7px] text-pixel-muted mb-1.5">COR DO CABELO</p>
              <div className="flex flex-wrap gap-1.5">
                {HAIR_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColorHair(c)}
                    className={`w-6 h-6 border-2 transition-colors ${
                      colorHair === c ? "border-pixel-accent scale-110" : "border-pixel-panel hover:border-pixel-accent/50"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input type="color" value={colorHair} onChange={(e) => setColorHair(e.target.value)}
                  className="w-6 h-6 cursor-pointer border-2 border-pixel-panel" />
              </div>
            </div>
            <div>
              <p className="font-pixel text-[7px] text-pixel-muted mb-1.5">CAMISA</p>
              <div className="flex flex-wrap gap-1.5">
                {SHIRT_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColorShirt(c)}
                    className={`w-6 h-6 border-2 transition-colors ${
                      colorShirt === c ? "border-pixel-accent scale-110" : "border-pixel-panel hover:border-pixel-accent/50"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input type="color" value={colorShirt} onChange={(e) => setColorShirt(e.target.value)}
                  className="w-6 h-6 cursor-pointer border-2 border-pixel-panel" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-3 py-2 border-t-2 border-pixel-panel">
        <button
          onClick={onClose}
          className="flex-1 py-1.5 font-pixel text-[8px] text-pixel-muted border-2 border-pixel-panel hover:border-pixel-accent/50 transition-colors"
        >
          CANCELAR
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-1.5 font-pixel text-[8px] text-white bg-pixel-accent border-2 border-pixel-accent/60 hover:bg-pixel-accent/80 disabled:opacity-50 transition-colors"
        >
          {saving ? "SALVANDO..." : "SALVAR"}
        </button>
      </div>
    </div>
  );
}
