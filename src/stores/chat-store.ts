"use client";

import { create } from "zustand";

export interface ChatBubble {
  id: string;
  memberId: string;
  memberName: string;
  message: string;
  timestamp: number;
  opacity: number;
}

export interface ChatHistoryEntry {
  id: string;
  memberName: string;
  message: string;
  timestamp: number;
}

const BUBBLE_DURATION_MS = 6000;
const MAX_BUBBLES = 50;
const MAX_HISTORY = 15;

interface ChatState {
  bubbles: ChatBubble[];
  history: ChatHistoryEntry[];
  addBubble: (bubble: Omit<ChatBubble, "opacity">) => void;
  updateBubbles: (deltaTime: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  bubbles: [],
  history: [],

  addBubble: (bubble) =>
    set((state) => {
      // Remove duplicata (mesmo id)
      const filtered = state.bubbles.filter((b) => b.id !== bubble.id);
      const newBubbles = [...filtered, { ...bubble, opacity: 1 }];

      // Adiciona ao historico (apenas se nao e duplicata)
      let newHistory = state.history;
      if (!state.history.some((h) => h.id === bubble.id)) {
        newHistory = [
          ...state.history,
          {
            id: bubble.id,
            memberName: bubble.memberName,
            message: bubble.message,
            timestamp: bubble.timestamp,
          },
        ];
        // Limita a MAX_HISTORY — remove as mais antigas
        if (newHistory.length > MAX_HISTORY) {
          newHistory = newHistory.slice(-MAX_HISTORY);
        }
      }

      return {
        bubbles: newBubbles.length > MAX_BUBBLES
          ? newBubbles.slice(-MAX_BUBBLES)
          : newBubbles,
        history: newHistory,
      };
    }),

  updateBubbles: (deltaTime) =>
    set((state) => {
      const now = Date.now();
      const updated = state.bubbles
        .map((b) => {
          const age = now - b.timestamp;
          if (age > BUBBLE_DURATION_MS) return null;
          const fadeStart = BUBBLE_DURATION_MS - 1000;
          const opacity = age > fadeStart ? 1 - (age - fadeStart) / 1000 : 1;
          return { ...b, opacity: Math.max(0, opacity) };
        })
        .filter((b): b is ChatBubble => b !== null);

      if (updated.length === state.bubbles.length) {
        let same = true;
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].opacity !== state.bubbles[i].opacity) {
            same = false;
            break;
          }
        }
        if (same) return state;
      }

      return { bubbles: updated };
    }),
}));
