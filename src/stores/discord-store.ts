"use client";

import { create } from "zustand";
import { DiscordPresence, DiscordStatus } from "@/types/discord";

interface DiscordState {
  presences: Map<string, DiscordPresence>;
  isConnected: boolean;

  setPresence: (discordId: string, presence: DiscordPresence) => void;
  updateStatus: (discordId: string, status: DiscordStatus) => void;
  setPresences: (presences: DiscordPresence[]) => void;
  removePresence: (discordId: string) => void;
  getStatus: (discordId: string) => DiscordStatus;
  setConnected: (connected: boolean) => void;
}

export const useDiscordStore = create<DiscordState>((set, get) => ({
  presences: new Map(),
  isConnected: false,

  setPresence: (discordId, presence) =>
    set((state) => {
      const newPresences = new Map(state.presences);
      newPresences.set(discordId, presence);
      return { presences: newPresences };
    }),

  updateStatus: (discordId, status) =>
    set((state) => {
      const newPresences = new Map(state.presences);
      const existing = newPresences.get(discordId);
      if (existing) {
        newPresences.set(discordId, {
          ...existing,
          status,
          lastChanged: new Date().toISOString(),
        });
      } else {
        newPresences.set(discordId, {
          userId: "",
          discordId,
          status,
          customStatus: null,
          lastChanged: new Date().toISOString(),
        });
      }
      return { presences: newPresences };
    }),

  setPresences: (presences) =>
    set(() => {
      const newMap = new Map<string, DiscordPresence>();
      for (const p of presences) {
        newMap.set(p.discordId, p);
      }
      return { presences: newMap };
    }),

  removePresence: (discordId) =>
    set((state) => {
      const newPresences = new Map(state.presences);
      newPresences.delete(discordId);
      return { presences: newPresences };
    }),

  getStatus: (discordId) => {
    const presence = get().presences.get(discordId);
    return presence?.status ?? "offline";
  },

  setConnected: (connected) => set({ isConnected: connected }),
}));
