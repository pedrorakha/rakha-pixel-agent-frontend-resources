"use client";

import { create } from "zustand";

const STORAGE_KEY = "rakha-selected-member";

type EmitVisualFn = (visual: {
  hat: string; glasses: string; hairStyle: string;
  colorShirt: string; colorHair: string; colorSkin: string;
}) => void;

interface PlayerState {
  selectedMemberId: string | null;
  selectedMemberName: string | null;
  isSelectingMember: boolean;
  isSpectator: boolean;
  emitVisualFn: EmitVisualFn | null;

  setSelectedMember: (id: string, name: string) => void;
  clearSelectedMember: () => void;
  setIsSelectingMember: (value: boolean) => void;
  enterSpectatorMode: () => void;
  loadFromStorage: () => void;
  setEmitVisualFn: (fn: EmitVisualFn) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  selectedMemberId: null,
  selectedMemberName: null,
  isSelectingMember: false,
  isSpectator: false,
  emitVisualFn: null,

  setSelectedMember: (id, name) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ memberId: id, memberName: name })
    );
    set({
      selectedMemberId: id,
      selectedMemberName: name,
      isSelectingMember: false,
    });
  },

  clearSelectedMember: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      selectedMemberId: null,
      selectedMemberName: null,
      isSelectingMember: true,
      isSpectator: false,
    });
  },

  setIsSelectingMember: (value) => set({ isSelectingMember: value }),

  enterSpectatorMode: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      selectedMemberId: null,
      selectedMemberName: null,
      isSelectingMember: false,
      isSpectator: true,
    });
  },

  setEmitVisualFn: (fn) => set({ emitVisualFn: fn }),

  loadFromStorage: () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      set({ isSelectingMember: true });
      return;
    }
    try {
      const parsed = JSON.parse(stored) as {
        memberId: string;
        memberName: string;
      };
      if (parsed.memberId && parsed.memberName) {
        set({
          selectedMemberId: parsed.memberId,
          selectedMemberName: parsed.memberName,
          isSelectingMember: false,
        });
      } else {
        set({ isSelectingMember: true });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      set({ isSelectingMember: true });
    }
  },
}));
