"use client";

import { create } from "zustand";

export interface FloatingReaction {
  id: string;
  memberId: string;
  emoji: string;
  timestamp: number;
  opacity: number;
  offsetY: number;
}

const REACTION_DURATION_MS = 2500;
const MAX_REACTIONS = 30;

interface ReactionState {
  reactions: FloatingReaction[];
  addReaction: (memberId: string, emoji: string, timestamp: number) => void;
  updateReactions: (deltaTime: number) => void;
}

export const useReactionStore = create<ReactionState>((set) => ({
  reactions: [],

  addReaction: (memberId, emoji, timestamp) =>
    set((state) => {
      const id = `${memberId}-${timestamp}`;
      if (state.reactions.some((r) => r.id === id)) return state;
      const newReactions = [
        ...state.reactions,
        { id, memberId, emoji, timestamp, opacity: 1, offsetY: 0 },
      ];
      return {
        reactions: newReactions.length > MAX_REACTIONS
          ? newReactions.slice(-MAX_REACTIONS)
          : newReactions,
      };
    }),

  updateReactions: (_deltaTime) =>
    set((state) => {
      const now = Date.now();
      const updated = state.reactions
        .map((r) => {
          const age = now - r.timestamp;
          if (age > REACTION_DURATION_MS) return null;
          const progress = age / REACTION_DURATION_MS;
          return {
            ...r,
            opacity: 1 - progress * progress,
            offsetY: progress * 40,
          };
        })
        .filter((r): r is FloatingReaction => r !== null);

      if (updated.length === state.reactions.length) {
        let same = true;
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].opacity !== state.reactions[i].opacity) {
            same = false;
            break;
          }
        }
        if (same) return state;
      }

      return { reactions: updated };
    }),
}));
