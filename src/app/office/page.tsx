"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { OfficeCanvas } from "@/components/canvas/office-canvas";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { useDiscordPresence } from "@/hooks/use-discord-presence";
import { useDiscordStore } from "@/stores/discord-store";
import { usePlayerStore } from "@/stores/player-store";
import { DiscordStatus } from "@/types/discord";
import { api } from "@/lib/api";
import { MusicPlayer } from "@/components/music/music-player";
import { PasswordGate } from "@/components/auth/password-gate";
import { MemberSelector } from "@/components/auth/member-selector";
import { VisualEditor, VisualData } from "@/components/character/visual-editor";
import { AccessoryHat, AccessoryGlasses, HairStyle } from "@/types/character";

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
  hair_style: string;
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

interface MemberEntry {
  id: string;
  name: string;
  discordId: string;
  status: DiscordStatus;
  deskLabel: string;
  hat: AccessoryHat;
  glasses: AccessoryGlasses;
  hairStyle: HairStyle;
  colorShirt: string;
  colorHair: string;
  colorSkin: string;
}

const stateDescriptions: Record<DiscordStatus, string> = {
  online: "Typing at computer",
  dnd: "Focused (headphones)",
  idle: "Drinking coffee",
  offline: "Sleeping",
};

export default function OfficePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  useDiscordPresence();
  const presences = useDiscordStore((s) => s.presences);

  const {
    selectedMemberId,
    selectedMemberName,
    isSelectingMember,
    isSpectator,
    loadFromStorage,
    clearSelectedMember,
  } = usePlayerStore();

  // Carrega member selecionado do localStorage ao montar
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (presences.size === 0 || members.length === 0) return;
    setMembers((prev) =>
      prev.map((m) => {
        const presence = presences.get(m.discordId);
        if (!presence) return m;
        if (presence.status === m.status) return m;
        return { ...m, status: presence.status };
      })
    );
  }, [presences]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [apiMembers, apiDesks] = await Promise.all([
        api.get<ApiMember[]>("/members"),
        api.get<ApiDesk[]>("/office/desks"),
      ]);
      const deskMap = new Map(apiDesks.map((d) => [d.id, d.label]));
      const mapped: MemberEntry[] = (apiMembers ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        discordId: m.discord_id,
        status: (m.current_status as DiscordStatus) || "offline",
        deskLabel: m.desk_id ? deskMap.get(m.desk_id) ?? "Unknown Desk" : "No Desk",
        hat: (m.accessory_hat || "none") as AccessoryHat,
        glasses: (m.accessory_glasses || "none") as AccessoryGlasses,
        hairStyle: (m.hair_style || "short") as HairStyle,
        colorShirt: m.color_shirt || "#3498db",
        colorHair: m.color_hair || "#4a3728",
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

  return (
    <PasswordGate area="office">
      {/* Seletor de membro — aparece apos senha, antes do escritorio */}
      {isSelectingMember && !isSpectator ? (
        <MemberSelector />
      ) : (
        <div className="w-screen overflow-hidden bg-pixel-bg relative" style={{ height: "100dvh" }}>
          {/* Music player */}
          <MusicPlayer />

          {/* Canvas — always full screen */}
          <OfficeCanvas />

          {/* Header bar — always on top */}
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-pixel-surface/90 border-b-2 border-pixel-panel">
            <div className="flex items-center gap-3 sm:gap-4">
              <h1 className="font-pixel text-[11px] sm:text-[13px] text-pixel-accent">
                RAKHA AGENT
              </h1>
              <Link
                href="/dashboard"
                className="font-pixel text-[9px] sm:text-[10px] text-pixel-muted hover:text-pixel-accent transition-colors"
              >
                [DASHBOARD]
              </Link>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Indicador do player logado */}
              {selectedMemberName && (
                <button
                  onClick={clearSelectedMember}
                  className="font-pixel text-[9px] sm:text-[10px] text-pixel-accent hover:text-pixel-text transition-colors"
                  title="Clique para trocar de personagem"
                >
                  [{selectedMemberName}]
                </button>
              )}
              {isSpectator && (
                <button
                  onClick={clearSelectedMember}
                  className="font-pixel text-[9px] sm:text-[10px] text-pixel-muted hover:text-pixel-text transition-colors"
                  title="Clique para selecionar um personagem"
                >
                  [ESPECTADOR]
                </button>
              )}
              <span className="font-pixel text-[9px] sm:text-[10px] text-pixel-muted hidden sm:inline">
                {members.length} members
              </span>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="font-pixel text-[10px] sm:text-[11px] text-pixel-text hover:text-pixel-accent transition-colors"
              >
                {sidebarOpen ? "[HIDE]" : "[MEMBERS]"}
              </button>
            </div>
          </div>

          {/* Sidebar overlay */}
          {sidebarOpen && (
            <>
              {/* Backdrop on mobile */}
              <div
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />

              {/* Sidebar panel */}
              <aside className="fixed top-0 right-0 h-screen w-72 sm:w-80 z-50 bg-pixel-surface border-l-4 border-pixel-panel flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b-2 border-pixel-panel shrink-0">
                  <h2 className="font-pixel text-[11px] text-pixel-muted uppercase">
                    Team Members
                  </h2>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="font-pixel text-[11px] text-pixel-muted hover:text-pixel-accent transition-colors"
                  >
                    [X]
                  </button>
                </div>

                {/* Members list — scrollable */}
                <div className="flex-1 overflow-y-auto">
                  {loading && (
                    <div className="py-8 flex justify-center">
                      <Loading text="Loading..." />
                    </div>
                  )}
                  {error && (
                    <div className="px-4 py-4">
                      <p className="font-pixel text-[10px] text-red-400">{error}</p>
                    </div>
                  )}
                  {!loading && !error && members.length === 0 && (
                    <div className="px-4 py-4">
                      <p className="font-pixel text-[10px] text-pixel-muted">No members yet</p>
                    </div>
                  )}
                  {!loading && !error && members.map((member) => (
                    <div
                      key={member.id}
                      className={`px-4 py-3.5 border-b border-pixel-panel/50 hover:bg-pixel-bg/50 transition-colors ${
                        member.id === selectedMemberId ? "bg-pixel-accent/10 border-l-2 border-l-pixel-accent" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-pixel text-[10px] sm:text-[11px] text-pixel-text">
                          {member.name}
                          {member.id === selectedMemberId && (
                            <span className="text-pixel-accent ml-1">(YOU)</span>
                          )}
                        </span>
                        <Badge status={member.status} showLabel={false} size="sm" />
                      </div>
                      <div className="font-pixel text-[9px] text-pixel-muted">
                        {member.deskLabel}
                      </div>
                      <div className="font-pixel text-[9px] text-pixel-accent/70 mt-0.5">
                        {stateDescriptions[member.status]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Trocar personagem */}
                {selectedMemberName && (
                  <div className="px-4 py-3 border-t-2 border-pixel-panel shrink-0">
                    <p className="font-pixel text-[8px] text-pixel-muted mb-2">Logado como:</p>
                    <div className="flex items-center justify-between">
                      <span className="font-pixel text-[10px] text-pixel-accent">{selectedMemberName}</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setShowVisualEditor(true)}
                          className="font-pixel text-[9px] text-pixel-muted hover:text-pixel-accent transition-colors border-2 border-pixel-panel hover:border-pixel-accent px-3 py-1.5"
                        >
                          VISUAL
                        </button>
                        <button
                          onClick={clearSelectedMember}
                          className="font-pixel text-[9px] text-pixel-muted hover:text-pixel-accent transition-colors border-2 border-pixel-panel hover:border-pixel-accent px-3 py-1.5"
                        >
                          TROCAR
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="px-4 py-4 border-t-2 border-pixel-panel shrink-0">
                  <h3 className="font-pixel text-[9px] sm:text-[10px] text-pixel-muted mb-2 uppercase">
                    Status Legend
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {(["online", "dnd", "idle", "offline"] as const).map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          s === "online" ? "bg-green-500" :
                          s === "dnd" ? "bg-red-500" :
                          s === "idle" ? "bg-yellow-500" : "bg-gray-500"
                        }`} />
                        <span className="font-pixel text-[9px] text-pixel-text">
                          {stateDescriptions[s]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </>
          )}
        </div>
      )}

      {/* Visual Editor Overlay */}
      {showVisualEditor && selectedMemberId && (() => {
        const currentMember = members.find((m) => m.id === selectedMemberId);
        if (!currentMember) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <VisualEditor
              memberId={selectedMemberId}
              initialHat={currentMember.hat}
              initialGlasses={currentMember.glasses}
              initialHairStyle={currentMember.hairStyle}
              initialColorShirt={currentMember.colorShirt}
              initialColorHair={currentMember.colorHair}
              initialColorSkin={currentMember.colorSkin}
              onClose={() => setShowVisualEditor(false)}
              onSave={(data: VisualData) => {
                // Emite visual via multiplayer para todos
                const emitFn = usePlayerStore.getState().emitVisualFn;
                if (emitFn) {
                  emitFn({
                    hat: data.accessory_hat,
                    glasses: data.accessory_glasses,
                    hairStyle: data.hair_style,
                    colorShirt: data.color_shirt,
                    colorHair: data.color_hair,
                    colorSkin: data.color_skin,
                  });
                }
                fetchData();
              }}
            />
          </div>
        );
      })()}
    </PasswordGate>
  );
}
