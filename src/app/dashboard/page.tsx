"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { DiscordStatus } from "@/types/discord";
import { api } from "@/lib/api";

interface ApiMember {
  id: string;
  name: string;
  discord_id: string;
  character_sprite: string;
  desk_id: string | null;
  current_status: string;
  current_animation: string;
  is_active: boolean;
  color_shirt: string;
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

const SPRITE_COLOR_MAP: Record<string, string> = {
  char_01: "#3498db",
  char_02: "#e74c3c",
  char_03: "#2ecc71",
  char_04: "#9b59b6",
  char_05: "#f39c12",
  char_06: "#1abc9c",
};

interface DashboardMember {
  id: string;
  name: string;
  discordId: string;
  color: string;
  sprite: string;
  deskId: string | null;
  deskLabel: string | null;
  status: DiscordStatus;
}

export default function DashboardOverview() {
  const [members, setMembers] = useState<DashboardMember[]>([]);
  const [desks, setDesks] = useState<ApiDesk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDeskId, setEditingDeskId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [savingDesk, setSavingDesk] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [apiMembers, apiDesks] = await Promise.all([
        api.get<ApiMember[]>("/members"),
        api.get<ApiDesk[]>("/office/desks"),
      ]);

      setDesks(apiDesks ?? []);

      const deskMap = new Map((apiDesks ?? []).map((d) => [d.id, d.label]));

      const mapped: DashboardMember[] = (apiMembers ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        discordId: m.discord_id,
        color: m.color_shirt || SPRITE_COLOR_MAP[m.character_sprite] || "#3498db",
        sprite: m.character_sprite,
        deskId: m.desk_id,
        deskLabel: m.desk_id ? deskMap.get(m.desk_id) ?? null : null,
        status: (m.current_status as DiscordStatus) || "offline",
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

  const handleSaveDeskLabel = useCallback(async (deskId: string) => {
    const trimmed = editingLabel.trim();
    if (!trimmed) return;
    setSavingDesk(true);
    try {
      await api.patch(`/office/desks/${deskId}`, { label: trimmed });
      setDesks((prev) => prev.map((d) => d.id === deskId ? { ...d, label: trimmed } : d));
      setMembers((prev) => prev.map((m) => m.deskId === deskId ? { ...m, deskLabel: trimmed } : m));
      setEditingDeskId(null);
    } catch {
      // Ignora erro silenciosamente
    } finally {
      setSavingDesk(false);
    }
  }, [editingLabel]);

  const onlineCount = members.filter((m) => m.status === "online").length;
  const dndCount = members.filter((m) => m.status === "dnd").length;
  const idleCount = members.filter((m) => m.status === "idle").length;
  const offlineCount = members.filter((m) => m.status === "offline").length;
  const occupiedDesks = members.filter((m) => m.deskId).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loading text="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="font-pixel text-[10px] text-red-400 mb-4">{error}</p>
        <Button onClick={fetchData} size="sm">RETRY</Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-pixel text-base text-pixel-accent">DASHBOARD</h1>
        <p className="font-pixel text-[10px] text-pixel-muted mt-1">
          Overview of your virtual office
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label="TOTAL MEMBERS" value={members.length} color="text-pixel-accent" />
        <StatCard label="ONLINE" value={onlineCount} color="text-green-500" />
        <StatCard label="FOCUSED" value={dndCount} color="text-red-500" />
        <StatCard label="IDLE" value={idleCount} color="text-yellow-500" />
        <StatCard label="OFFLINE" value={offlineCount} color="text-gray-500" />
        <StatCard label="DESKS" value={desks.length} color="text-blue-400" />
        <StatCard label="OCCUPIED" value={occupiedDesks} color="text-purple-400" />
        <StatCard label="AVAILABLE" value={Math.max(0, desks.length - occupiedDesks)} color="text-emerald-400" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
        <QuickAction
          href="/dashboard/office-editor"
          title="EDIT OFFICE"
          description="Drag & drop desks, walls, furniture"
          icon="[#]"
        />
        <QuickAction
          href="/dashboard/members"
          title="MANAGE MEMBERS"
          description="Add, remove, assign to desks"
          icon="[M]"
        />
        <QuickAction
          href="/dashboard/characters"
          title="CUSTOMIZE CHARACTERS"
          description="Choose sprites, colors, accessories"
          icon="[C]"
        />
      </div>

      {/* Room management */}
      <section className="bg-pixel-surface border-4 border-pixel-panel p-5 mb-6 sm:mb-8">
        <h2 className="font-pixel text-[13px] text-pixel-text mb-4">ROOMS</h2>
        <div className="flex flex-col gap-2">
          {desks.length === 0 && (
            <p className="font-pixel text-[11px] text-pixel-muted py-4 text-center">
              No rooms configured yet.
            </p>
          )}
          {desks.map((desk) => {
            const assignedMember = members.find((m) => m.deskId === desk.id);
            const isEditing = editingDeskId === desk.id;
            return (
              <div
                key={desk.id}
                className="flex items-center justify-between bg-pixel-bg/50 border-2 border-pixel-panel/50 px-4 py-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="font-pixel text-[11px] text-pixel-accent shrink-0">[R]</span>
                  {isEditing ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleSaveDeskLabel(desk.id); }}
                      className="flex items-center gap-2 flex-1"
                    >
                      <input
                        type="text"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        className="font-pixel text-[11px] text-pixel-text bg-pixel-bg border-2 border-pixel-accent px-2 py-1 w-full max-w-[180px] outline-none"
                        autoFocus
                        disabled={savingDesk}
                      />
                      <Button size="sm" variant="primary" type="submit" disabled={savingDesk || !editingLabel.trim()}>
                        OK
                      </Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => setEditingDeskId(null)} disabled={savingDesk}>
                        X
                      </Button>
                    </form>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <span className="font-pixel text-[11px] text-pixel-text block truncate">
                        {desk.label}
                      </span>
                      {assignedMember ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div
                            className="w-3 h-3 border border-white/20 shrink-0"
                            style={{ backgroundColor: assignedMember.color }}
                          />
                          <span className="font-pixel text-[9px] text-pixel-muted truncate">
                            {assignedMember.name}
                          </span>
                          <Badge status={assignedMember.status} size="sm" showLabel={false} />
                        </div>
                      ) : (
                        <span className="font-pixel text-[9px] text-pixel-muted">Empty</span>
                      )}
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <button
                    onClick={() => { setEditingDeskId(desk.id); setEditingLabel(desk.label); }}
                    className="font-pixel text-[9px] text-pixel-muted hover:text-pixel-accent transition-colors border-2 border-pixel-panel hover:border-pixel-accent px-2 py-1 shrink-0"
                  >
                    RENAME
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent activity */}
      <section className="bg-pixel-surface border-4 border-pixel-panel p-5">
        <h2 className="font-pixel text-[13px] text-pixel-text mb-4">MEMBERS STATUS</h2>
        <div className="flex flex-col gap-2.5">
          {members.length === 0 && (
            <p className="font-pixel text-[11px] text-pixel-muted py-4 text-center">
              No members yet. Add members to get started.
            </p>
          )}
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between bg-pixel-bg/50 border-2 border-pixel-panel/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 border-2 border-white/20"
                  style={{ backgroundColor: member.color }}
                />
                <div>
                  <span className="font-pixel text-[11px] text-pixel-text block">
                    {member.name}
                  </span>
                  <span className="font-pixel text-[9px] text-pixel-muted">
                    {member.deskLabel ?? "No desk assigned"}
                  </span>
                </div>
              </div>
              <Badge status={member.status} size="sm" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-pixel-surface border-4 border-pixel-panel p-5 text-center">
      <div className={`font-pixel text-2xl ${color}`}>{value}</div>
      <div className="font-pixel text-[9px] text-pixel-muted mt-2">{label}</div>
    </div>
  );
}

function QuickAction({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-pixel-surface border-4 border-pixel-panel p-4 hover:border-pixel-accent transition-colors group"
    >
      <span className="font-pixel text-[15px] text-pixel-muted group-hover:text-pixel-accent transition-colors">
        {icon}
      </span>
      <h3 className="font-pixel text-[12px] text-pixel-text mt-2">{title}</h3>
      <p className="font-pixel text-[9px] text-pixel-muted mt-1">{description}</p>
    </Link>
  );
}
