"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { DiscordStatus } from "@/types/discord";
import { CharacterState } from "@/types/character";
import { COLORS, STATUS_COLORS, STATUS_TO_CHARACTER_STATE, CHARACTER_WIDTH, CHARACTER_HEIGHT } from "@/lib/constants";
import { api } from "@/lib/api";

const SPRITE_OPTIONS = ["char_01", "char_02", "char_03", "char_04", "char_05", "char_06"] as const;

const SPRITE_COLORS: Record<string, { shirt: string; hair: string }> = {
  char_01: { shirt: "#3498db", hair: "#4a3728" },
  char_02: { shirt: "#e74c3c", hair: "#2c3e50" },
  char_03: { shirt: "#2ecc71", hair: "#d35400" },
  char_04: { shirt: "#9b59b6", hair: "#1a1a2e" },
  char_05: { shirt: "#f39c12", hair: "#7f8c8d" },
  char_06: { shirt: "#1abc9c", hair: "#8b4513" },
};

interface ApiMember {
  id: string;
  name: string;
  discord_id: string;
  character_sprite: string;
  desk_id: string | null;
  current_status: string;
  current_animation: string;
  is_active: boolean;
  accessory_hat: string;
  accessory_glasses: string;
  color_shirt: string;
  color_hair: string;
  color_skin: string;
  created_at: string;
  updated_at: string;
}

interface ApiDesk {
  id: string;
  label: string;
  grid_x: number;
  grid_y: number;
  direction: string;
  created_at: string;
  updated_at: string;
}

interface Member {
  id: string;
  name: string;
  discordId: string;
  sprite: string;
  color: string;
  deskId: string | null;
  status: DiscordStatus;
  isActive: boolean;
  hat: string;
  glasses: string;
  colorShirt: string;
  colorHair: string;
  colorSkin: string;
}

interface DeskOption {
  id: string;
  label: string;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [desks, setDesks] = useState<DeskOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [filter, setFilter] = useState<"all" | DiscordStatus>("all");
  const [search, setSearch] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDiscordId, setFormDiscordId] = useState("");
  const [formSprite, setFormSprite] = useState<string>("char_01");
  const [formDeskId, setFormDeskId] = useState<string>("");
  const [formHat, setFormHat] = useState<string>("none");
  const [formGlasses, setFormGlasses] = useState<string>("none");
  const [formColorShirt, setFormColorShirt] = useState("#3498db");
  const [formColorHair, setFormColorHair] = useState("#4a3728");
  const [formColorSkin, setFormColorSkin] = useState("#ffccaa");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [apiMembers, apiDesks] = await Promise.all([
        api.get<ApiMember[]>("/members"),
        api.get<ApiDesk[]>("/office/desks"),
      ]);

      const deskOptions: DeskOption[] = (apiDesks ?? []).map((d) => ({
        id: d.id,
        label: d.label,
      }));
      setDesks(deskOptions);

      const deskMap = new Map(deskOptions.map((d) => [d.id, d.label]));

      const mapped: Member[] = (apiMembers ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        discordId: m.discord_id,
        sprite: m.character_sprite,
        color: SPRITE_COLORS[m.character_sprite]?.shirt ?? "#3498db",
        deskId: m.desk_id,
        status: (m.current_status as DiscordStatus) || "offline",
        isActive: m.is_active,
        hat: m.accessory_hat || "none",
        glasses: m.accessory_glasses || "none",
        colorShirt: m.color_shirt || SPRITE_COLORS[m.character_sprite]?.shirt || "#3498db",
        colorHair: m.color_hair || SPRITE_COLORS[m.character_sprite]?.hair || "#4a3728",
        colorSkin: m.color_skin || "#ffccaa",
      }));

      setMembers(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMembers = members.filter((m) => {
    if (filter !== "all" && m.status !== filter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openEdit = useCallback((member: Member) => {
    setEditingMember(member);
    setFormName(member.name);
    setFormDiscordId(member.discordId);
    setFormSprite(member.sprite);
    setFormDeskId(member.deskId ?? "");
    setFormHat(member.hat);
    setFormGlasses(member.glasses);
    setFormColorShirt(member.colorShirt);
    setFormColorHair(member.colorHair);
    setFormColorSkin(member.colorSkin);
    setShowEditModal(true);
  }, []);

  const handleSpriteChange = useCallback((newSprite: string) => {
    setFormSprite(newSprite);
    const colors = SPRITE_COLORS[newSprite];
    if (colors) {
      setFormColorShirt(colors.shirt);
      setFormColorHair(colors.hair);
    }
  }, []);

  const openAdd = useCallback(() => {
    setFormName("");
    setFormDiscordId("");
    setFormSprite("char_01");
    setFormDeskId("");
    setFormHat("none");
    setFormGlasses("none");
    setFormColorShirt("#3498db");
    setFormColorHair("#4a3728");
    setFormColorSkin("#ffccaa");
    setShowAddModal(true);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!formName || !formDiscordId) return;
    try {
      setMutating(true);
      await api.post("/members", {
        name: formName,
        discord_id: formDiscordId,
        character_sprite: formSprite,
        desk_id: formDeskId || null,
        accessory_hat: formHat,
        accessory_glasses: formGlasses,
        color_shirt: formColorShirt,
        color_hair: formColorHair,
        color_skin: formColorSkin,
      });
      setShowAddModal(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setMutating(false);
    }
  }, [formName, formDiscordId, formSprite, formDeskId, formHat, formGlasses, formColorShirt, formColorHair, formColorSkin, fetchData]);

  const handleEdit = useCallback(async () => {
    if (!editingMember || !formName) return;
    try {
      setMutating(true);
      await api.patch("/members/" + editingMember.id, {
        name: formName,
        discord_id: formDiscordId,
        character_sprite: formSprite,
        desk_id: formDeskId || null,
        accessory_hat: formHat,
        accessory_glasses: formGlasses,
        color_shirt: formColorShirt,
        color_hair: formColorHair,
        color_skin: formColorSkin,
      });
      setShowEditModal(false);
      setEditingMember(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      setMutating(false);
    }
  }, [editingMember, formName, formDiscordId, formSprite, formDeskId, formHat, formGlasses, formColorShirt, formColorHair, formColorSkin, fetchData]);

  const handleRemove = useCallback(async (id: string) => {
    try {
      setMutating(true);
      await api.delete("/members/" + id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete member");
    } finally {
      setMutating(false);
    }
  }, [fetchData]);

  const handleToggleActive = useCallback(async (id: string) => {
    const member = members.find((m) => m.id === id);
    if (!member) return;
    try {
      setMutating(true);
      await api.patch("/members/" + id, { is_active: !member.isActive });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle member");
    } finally {
      setMutating(false);
    }
  }, [members, fetchData]);

  const unassignedDesks = desks.filter(
    (d) => !members.some((m) => m.deskId === d.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loading text="Loading members..." />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-pixel text-sm text-pixel-accent">MEMBERS</h1>
          <p className="font-pixel text-[7px] text-pixel-muted mt-1">
            {members.length} members • {members.filter((m) => m.isActive).length} active
          </p>
        </div>
        <Button onClick={openAdd} disabled={mutating}>+ ADD MEMBER</Button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 border-2 border-red-600/50 bg-red-900/20">
          <p className="font-pixel text-[7px] text-red-400">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 items-center flex-wrap">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
        />
        <div className="flex gap-1">
          {(["all", "online", "dnd", "idle", "offline"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                font-pixel text-[7px] px-3 py-1.5 border-2 transition-all
                ${filter === f
                  ? "bg-pixel-accent/20 border-pixel-accent text-pixel-accent"
                  : "border-pixel-panel text-pixel-muted hover:text-pixel-text"
                }
              `}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Members grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredMembers.map((member) => {
          const desk = desks.find((d) => d.id === member.deskId);
          return (
            <MemberCard
              key={member.id}
              member={member}
              deskLabel={desk?.label}
              onEdit={() => openEdit(member)}
              onRemove={() => handleRemove(member.id)}
              onToggleActive={() => handleToggleActive(member.id)}
              disabled={mutating}
            />
          );
        })}
      </div>

      {filteredMembers.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="font-pixel text-[10px] text-pixel-muted">No members found</p>
        </div>
      )}

      {/* Add Member Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Member">
        <MemberForm
          name={formName}
          discordId={formDiscordId}
          sprite={formSprite}
          deskId={formDeskId}
          hat={formHat}
          glasses={formGlasses}
          desks={unassignedDesks}
          onNameChange={setFormName}
          onDiscordIdChange={setFormDiscordId}
          onSpriteChange={handleSpriteChange}
          onDeskIdChange={setFormDeskId}
          onHatChange={setFormHat}
          onGlassesChange={setFormGlasses}
          colorShirt={formColorShirt}
          colorHair={formColorHair}
          colorSkin={formColorSkin}
          onColorShirtChange={setFormColorShirt}
          onColorHairChange={setFormColorHair}
          onColorSkinChange={setFormColorSkin}
          onSubmit={handleAdd}
          onCancel={() => setShowAddModal(false)}
          submitLabel="ADD MEMBER"
          isLoading={mutating}
        />
      </Modal>

      {/* Edit Member Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingMember(null); }} title="Edit Member">
        <MemberForm
          name={formName}
          discordId={formDiscordId}
          sprite={formSprite}
          deskId={formDeskId}
          hat={formHat}
          glasses={formGlasses}
          desks={[
            ...(editingMember?.deskId ? desks.filter((d) => d.id === editingMember.deskId) : []),
            ...unassignedDesks,
          ]}
          onNameChange={setFormName}
          onDiscordIdChange={setFormDiscordId}
          onSpriteChange={handleSpriteChange}
          onDeskIdChange={setFormDeskId}
          onHatChange={setFormHat}
          onGlassesChange={setFormGlasses}
          colorShirt={formColorShirt}
          colorHair={formColorHair}
          colorSkin={formColorSkin}
          onColorShirtChange={setFormColorShirt}
          onColorHairChange={setFormColorHair}
          onColorSkinChange={setFormColorSkin}
          onSubmit={handleEdit}
          onCancel={() => { setShowEditModal(false); setEditingMember(null); }}
          submitLabel="SAVE CHANGES"
          isLoading={mutating}
        />
      </Modal>
    </div>
  );
}

// --- Sub-components ---

function MemberCard({
  member,
  deskLabel,
  onEdit,
  onRemove,
  onToggleActive,
  disabled,
}: {
  member: Member;
  deskLabel?: string;
  onEdit: () => void;
  onRemove: () => void;
  onToggleActive: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`bg-pixel-surface border-4 border-pixel-panel p-4 ${!member.isActive ? "opacity-50" : ""}`}>
      <div className="flex gap-4">
        {/* Character preview */}
        <CharacterPreview
          sprite={member.sprite}
          color={member.color}
          status={member.status}
          hat={member.hat}
          glasses={member.glasses}
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-pixel text-[9px] text-pixel-text truncate">{member.name}</h3>
            <Badge status={member.status} size="sm" showLabel={false} />
          </div>
          <p className="font-pixel text-[6px] text-pixel-muted mb-1 truncate">
            Discord: {member.discordId}
          </p>
          <p className="font-pixel text-[6px] text-pixel-muted mb-1">
            Sprite: {member.sprite}
          </p>
          <p className="font-pixel text-[6px] text-pixel-muted">
            Desk: {deskLabel ?? "Unassigned"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t-2 border-pixel-panel/50">
        <Button size="sm" variant="secondary" onClick={onEdit} className="flex-1" disabled={disabled}>
          EDIT
        </Button>
        <Button size="sm" variant="ghost" onClick={onToggleActive} disabled={disabled}>
          {member.isActive ? "DISABLE" : "ENABLE"}
        </Button>
        <Button size="sm" variant="danger" onClick={onRemove} disabled={disabled}>
          DEL
        </Button>
      </div>
    </div>
  );
}

function CharacterPreview({
  sprite,
  color,
  status,
  hat = "none",
  glasses = "none",
  customShirt,
  customHair,
  customSkin,
  size = "sm",
}: {
  sprite: string;
  color: string;
  status: DiscordStatus;
  hat?: string;
  glasses?: string;
  customShirt?: string;
  customHair?: string;
  customSkin?: string;
  size?: "sm" | "lg";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const timerRef = useRef(0);

  const isLarge = size === "lg";
  const canvasW = isLarge ? 96 : 48;
  const canvasH = isLarge ? 120 : 64;
  const z = isLarge ? 5 : 3;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvasW;
    canvas.height = canvasH;
    ctx.imageSmoothingEnabled = false;

    const charState = STATUS_TO_CHARACTER_STATE[status];
    const defaultSpriteColor = SPRITE_COLORS[sprite] ?? SPRITE_COLORS.char_01;
    const shirtC = customShirt || defaultSpriteColor.shirt;
    const hairC = customHair || defaultSpriteColor.hair;
    const skinC = customSkin || COLORS.skin;

    let animId: number;
    let lastTime = 0;

    const draw = (time: number) => {
      const dt = time - lastTime;
      timerRef.current += dt;
      lastTime = time;

      const speed = charState === "sleeping" ? 800 : charState === "focused" ? 500 : 250;
      if (timerRef.current > speed) {
        frameRef.current = (frameRef.current + 1) % 4;
        timerRef.current = 0;
      }

      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.fillStyle = "rgba(26,26,46,0.5)";
      ctx.fillRect(0, 0, canvasW, canvasH);

      const cx = isLarge ? 22 : 12;
      const cy = isLarge ? 24 : 12;
      const cw = CHARACTER_WIDTH * z * 0.7;
      const ch = CHARACTER_HEIGHT * z * 0.7;

      // Head
      const headSize = cw * 0.65;
      const headX = cx + (cw - headSize) / 2;
      ctx.fillStyle = skinC;
      ctx.fillRect(headX, cy, headSize, headSize);

      // Hair
      ctx.fillStyle = hairC;
      ctx.fillRect(headX, cy, headSize, z * 1.3);
      ctx.fillRect(headX, cy, z * 1, headSize * 0.5);
      ctx.fillRect(headX + headSize - z * 1, cy, z * 1, headSize * 0.5);

      // Eyes
      if (charState !== "sleeping") {
        ctx.fillStyle = "#000";
        ctx.fillRect(headX + z * 1, cy + headSize * 0.4, z * 0.7, z * 0.7);
        ctx.fillRect(headX + headSize - z * 1.7, cy + headSize * 0.4, z * 0.7, z * 0.7);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(headX + z * 0.8, cy + headSize * 0.5, z * 1, 1);
        ctx.fillRect(headX + headSize - z * 1.8, cy + headSize * 0.5, z * 1, 1);
      }

      // Body
      const bodyY = cy + headSize + z * 0.3;
      ctx.fillStyle = shirtC;
      ctx.fillRect(cx + z * 0.5, bodyY, cw - z * 1, ch * 0.35);

      // Pants
      ctx.fillStyle = COLORS.pants;
      ctx.fillRect(cx + z * 0.5, bodyY + ch * 0.35, cw - z * 1, ch * 0.2);

      // State-specific
      if (charState === "typing") {
        const armOff = frameRef.current % 2 === 0 ? 0 : -z * 0.7;
        ctx.fillStyle = skinC;
        ctx.fillRect(cx - z * 0.5, bodyY + z * 0.5 + armOff, z * 0.8, z * 2);
        ctx.fillRect(cx + cw - z * 0.3, bodyY + z * 0.5 - armOff, z * 0.8, z * 2);
      } else if (charState === "focused") {
        ctx.fillStyle = COLORS.headphones;
        ctx.fillRect(headX - z * 0.5, cy - z * 0.3, headSize + z * 1, z * 0.8);
        ctx.fillStyle = COLORS.headphonesAccent;
        ctx.fillRect(headX - z * 0.8, cy + z * 0.8, z * 1.2, z * 1.5);
        ctx.fillRect(headX + headSize - z * 0.3, cy + z * 0.8, z * 1.2, z * 1.5);
      } else if (charState === "drinking_coffee") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(cx + cw, bodyY + z * 0.5, z * 1.5, z * 2.5);
        ctx.fillStyle = COLORS.coffeeCup;
        ctx.fillRect(cx + cw + z * 0.3, bodyY + z * 1, z * 1, z * 1.5);
      }

      // --- Hat ---
      if (hat !== "none" && charState !== "sleeping") {
        drawPreviewHat(ctx, headX, cy, headSize, z, hat);
      }

      // --- Glasses ---
      if (glasses !== "none" && charState !== "sleeping") {
        drawPreviewGlasses(ctx, headX, cy, headSize, z, glasses);
      }

      // Status indicator
      ctx.fillStyle = STATUS_COLORS[status];
      ctx.beginPath();
      ctx.arc(canvasW - z * 2, z * 2, z * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = z * 0.5;
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [sprite, color, status, hat, glasses, customShirt, customHair, customSkin, z, canvasW, canvasH, isLarge]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasW}
      height={canvasH}
      className="border-2 border-pixel-panel shrink-0"
    />
  );
}

function drawPreviewHat(ctx: CanvasRenderingContext2D, headX: number, headY: number, headSize: number, z: number, hat: string) {
  switch (hat) {
    case "cap":
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(headX - z * 0.3, headY - z * 1, headSize + z * 0.6, z * 1.2);
      ctx.fillStyle = "#a93226";
      ctx.fillRect(headX - z * 0.6, headY - z * 0.1, headSize * 0.6, z * 0.6);
      break;
    case "beanie":
      ctx.fillStyle = "#8e44ad";
      ctx.fillRect(headX - z * 0.3, headY - z * 1.3, headSize + z * 0.6, z * 1.5);
      ctx.fillStyle = "#7d3c98";
      ctx.fillRect(headX - z * 0.3, headY - z * 0.3, headSize + z * 0.6, z * 0.6);
      ctx.fillStyle = "#f1c40f";
      ctx.fillRect(headX + headSize / 2 - z * 0.5, headY - z * 2, z * 1, z * 1);
      break;
    case "tophat":
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(headX - z * 0.5, headY - z * 0.5, headSize + z * 1, z * 0.6);
      ctx.fillRect(headX + z * 0.2, headY - z * 2.5, headSize - z * 0.4, z * 2.2);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(headX + z * 0.2, headY - z * 1.2, headSize - z * 0.4, z * 0.4);
      break;
    case "crown":
      ctx.fillStyle = "#f1c40f";
      ctx.fillRect(headX - z * 0.3, headY - z * 0.6, headSize + z * 0.6, z * 0.8);
      ctx.fillRect(headX, headY - z * 1.5, z * 0.6, z * 1);
      ctx.fillRect(headX + headSize / 2 - z * 0.3, headY - z * 1.8, z * 0.6, z * 1.3);
      ctx.fillRect(headX + headSize - z * 0.6, headY - z * 1.5, z * 0.6, z * 1);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(headX + headSize / 2 - z * 0.2, headY - z * 0.4, z * 0.4, z * 0.4);
      break;
    case "headband":
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(headX - z * 0.3, headY + z * 0.3, headSize + z * 0.6, z * 0.6);
      break;
  }
}

function drawPreviewGlasses(ctx: CanvasRenderingContext2D, headX: number, headY: number, headSize: number, z: number, glasses: string) {
  const eyeY = headY + headSize * 0.35;
  switch (glasses) {
    case "round":
      ctx.strokeStyle = "#333";
      ctx.lineWidth = z * 0.25;
      ctx.beginPath();
      ctx.arc(headX + z * 0.8, eyeY + z * 0.3, z * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(headX + headSize - z * 0.8, eyeY + z * 0.3, z * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(headX + z * 1.4, eyeY + z * 0.3);
      ctx.lineTo(headX + headSize - z * 1.4, eyeY + z * 0.3);
      ctx.stroke();
      break;
    case "square":
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = z * 0.25;
      ctx.strokeRect(headX + z * 0.2, eyeY - z * 0.1, z * 1.2, z * 0.9);
      ctx.strokeRect(headX + headSize - z * 1.4, eyeY - z * 0.1, z * 1.2, z * 0.9);
      ctx.beginPath();
      ctx.moveTo(headX + z * 1.4, eyeY + z * 0.3);
      ctx.lineTo(headX + headSize - z * 1.4, eyeY + z * 0.3);
      ctx.stroke();
      break;
    case "sunglasses":
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(headX + z * 0.2, eyeY - z * 0.1, z * 1.2, z * 0.9);
      ctx.fillRect(headX + headSize - z * 1.4, eyeY - z * 0.1, z * 1.2, z * 0.9);
      ctx.fillRect(headX + z * 1.4, eyeY + z * 0.1, headSize - z * 2.8, z * 0.3);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(headX + z * 0.4, eyeY, z * 0.3, z * 0.3);
      break;
    case "monocle":
      ctx.strokeStyle = "#c0a030";
      ctx.lineWidth = z * 0.25;
      ctx.beginPath();
      ctx.arc(headX + headSize - z * 0.8, eyeY + z * 0.3, z * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(headX + headSize - z * 0.2, eyeY + z * 0.9);
      ctx.lineTo(headX + headSize + z * 0.3, eyeY + z * 2);
      ctx.stroke();
      break;
  }
}

const HAT_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "cap", label: "Cap" },
  { value: "beanie", label: "Beanie" },
  { value: "tophat", label: "Top Hat" },
  { value: "crown", label: "Crown" },
  { value: "headband", label: "Headband" },
];

const GLASSES_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "round", label: "Round" },
  { value: "square", label: "Square" },
  { value: "sunglasses", label: "Sunglasses" },
  { value: "monocle", label: "Monocle" },
];

function MemberForm({
  name,
  discordId,
  sprite,
  deskId,
  hat,
  glasses,
  colorShirt,
  colorHair,
  colorSkin,
  desks,
  onNameChange,
  onDiscordIdChange,
  onSpriteChange,
  onDeskIdChange,
  onHatChange,
  onGlassesChange,
  onColorShirtChange,
  onColorHairChange,
  onColorSkinChange,
  onSubmit,
  onCancel,
  submitLabel,
  isLoading,
}: {
  name: string;
  discordId: string;
  sprite: string;
  deskId: string;
  hat: string;
  glasses: string;
  colorShirt: string;
  colorHair: string;
  colorSkin: string;
  desks: { id: string; label: string }[];
  onNameChange: (v: string) => void;
  onDiscordIdChange: (v: string) => void;
  onSpriteChange: (v: string) => void;
  onDeskIdChange: (v: string) => void;
  onHatChange: (v: string) => void;
  onGlassesChange: (v: string) => void;
  onColorShirtChange: (v: string) => void;
  onColorHairChange: (v: string) => void;
  onColorSkinChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  isLoading?: boolean;
}) {
  const previewColor = colorShirt || SPRITE_COLORS[sprite]?.shirt || "#3498db";

  return (
    <div className="flex gap-4">
      {/* Left: form fields */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
      <Input label="Name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. John" />
      <Input label="Discord ID" value={discordId} onChange={(e) => onDiscordIdChange(e.target.value)} placeholder="e.g. 123456789012345678" />

      {/* Sprite selector */}
      <div className="flex flex-col gap-1">
        <label className="font-pixel text-[8px] text-pixel-muted uppercase">Character Sprite</label>
        <div className="grid grid-cols-6 gap-2">
          {SPRITE_OPTIONS.map((s) => {
            const sc = SPRITE_COLORS[s];
            return (
              <button
                key={s}
                onClick={() => onSpriteChange(s)}
                className={`
                  w-full aspect-square border-2 flex items-center justify-center transition-all
                  ${sprite === s ? "border-pixel-accent bg-pixel-accent/20" : "border-pixel-panel hover:border-pixel-accent/50"}
                `}
              >
                <div className="w-5 h-7 relative">
                  <div className="absolute top-0 left-1 w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.skin }} />
                  <div className="absolute top-0 left-1 w-3 h-1" style={{ backgroundColor: sc.hair }} />
                  <div className="absolute top-3 left-0 w-5 h-2.5" style={{ backgroundColor: sc.shirt }} />
                  <div className="absolute top-[22px] left-0 w-5 h-1.5" style={{ backgroundColor: COLORS.pants }} />
                </div>
              </button>
            );
          })}
        </div>
        <span className="font-pixel text-[6px] text-pixel-muted">{sprite}</span>
      </div>

      {/* Accessories */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-pixel text-[8px] text-pixel-muted uppercase">Hat</label>
          <select
            value={hat}
            onChange={(e) => onHatChange(e.target.value)}
            className="font-pixel text-[9px] bg-pixel-bg text-pixel-text border-2 border-pixel-panel px-2 py-1.5"
          >
            {HAT_OPTIONS.map((h) => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-pixel text-[8px] text-pixel-muted uppercase">Glasses</label>
          <select
            value={glasses}
            onChange={(e) => onGlassesChange(e.target.value)}
            className="font-pixel text-[9px] bg-pixel-bg text-pixel-text border-2 border-pixel-panel px-2 py-1.5"
          >
            {GLASSES_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Colors */}
      <div className="flex flex-col gap-2">
        <label className="font-pixel text-[8px] text-pixel-muted uppercase">Colors</label>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-pixel text-[6px] text-pixel-muted">Shirt</span>
            <input type="color" value={colorShirt} onChange={(e) => onColorShirtChange(e.target.value)}
              className="w-full h-7 border-2 border-pixel-panel cursor-pointer bg-transparent" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-pixel text-[6px] text-pixel-muted">Hair</span>
            <input type="color" value={colorHair} onChange={(e) => onColorHairChange(e.target.value)}
              className="w-full h-7 border-2 border-pixel-panel cursor-pointer bg-transparent" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-pixel text-[6px] text-pixel-muted">Skin</span>
            <input type="color" value={colorSkin} onChange={(e) => onColorSkinChange(e.target.value)}
              className="w-full h-7 border-2 border-pixel-panel cursor-pointer bg-transparent" />
          </div>
        </div>
      </div>

      {/* Desk assignment */}
      <div className="flex flex-col gap-1">
        <label className="font-pixel text-[8px] text-pixel-muted uppercase">Assign to Desk</label>
        <select
          value={deskId}
          onChange={(e) => onDeskIdChange(e.target.value)}
          className="font-pixel text-[10px] bg-pixel-bg text-pixel-text border-2 border-pixel-panel px-3 py-2"
        >
          <option value="">No desk (unassigned)</option>
          {desks.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 mt-2">
        <Button onClick={onSubmit} className="flex-1" disabled={!name || !discordId || isLoading} isLoading={isLoading}>
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
          CANCEL
        </Button>
      </div>
      </div>

      {/* Right: live character preview */}
      <div className="hidden sm:flex flex-col items-center gap-2 shrink-0">
        <p className="font-pixel text-[6px] text-pixel-muted uppercase">Preview</p>
        <CharacterPreview
          sprite={sprite}
          color={previewColor}
          status="online"
          hat={hat}
          glasses={glasses}
          customShirt={colorShirt}
          customHair={colorHair}
          customSkin={colorSkin}
          size="lg"
        />
        <div className="flex flex-col items-center gap-0.5">
          {hat !== "none" && (
            <span className="font-pixel text-[5px] text-pixel-accent">{hat}</span>
          )}
          {glasses !== "none" && (
            <span className="font-pixel text-[5px] text-pixel-accent">{glasses}</span>
          )}
        </div>
      </div>
    </div>
  );
}
