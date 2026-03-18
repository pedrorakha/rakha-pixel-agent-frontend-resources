"use client";

import { create } from "zustand";

const STORAGE_KEY = "rakha-selected-member";

interface PlayerState {
  selectedMemberId: string | null;
  selectedMemberName: string | null;
  isSelectingMember: boolean;

  setSelectedMember: (id: string, name: string) => void;
  clearSelectedMember: () => void;
  setIsSelectingMember: (value: boolean) => void;
  loadFromStorage: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  selectedMemberId: null,
  selectedMemberName: null,
  isSelectingMember: false,

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
    });
  },

  setIsSelectingMember: (value) => set({ isSelectingMember: value }),

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
