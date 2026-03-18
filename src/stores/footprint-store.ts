"use client";

import { create } from "zustand";

export interface Footprint {
  id: number;
  gridX: number;
  gridY: number;
  timestamp: number;
  opacity: number;
}

const FOOTPRINT_DURATION_MS = 3000;
const MAX_FOOTPRINTS = 60;

let footprintId = 0;

interface FootprintState {
  footprints: Footprint[];
  addFootprint: (gridX: number, gridY: number) => void;
  updateFootprints: () => void;
}

export const useFootprintStore = create<FootprintState>((set) => ({
  footprints: [],

  addFootprint: (gridX, gridY) =>
    set((state) => {
      // Nao duplica na mesma posicao se ja tem recente
      const recent = state.footprints.find(
        (f) => f.gridX === gridX && f.gridY === gridY && Date.now() - f.timestamp < 500
      );
      if (recent) return state;

      const fp: Footprint = {
        id: footprintId++,
        gridX,
        gridY,
        timestamp: Date.now(),
        opacity: 0.4,
      };
      const newList = [...state.footprints, fp];
      return {
        footprints: newList.length > MAX_FOOTPRINTS
          ? newList.slice(-MAX_FOOTPRINTS)
          : newList,
      };
    }),

  updateFootprints: () =>
    set((state) => {
      const now = Date.now();
      const updated = state.footprints
        .map((f) => {
          const age = now - f.timestamp;
          if (age > FOOTPRINT_DURATION_MS) return null;
          return { ...f, opacity: 0.4 * (1 - age / FOOTPRINT_DURATION_MS) };
        })
        .filter((f): f is Footprint => f !== null);

      if (updated.length === state.footprints.length) return state;
      return { footprints: updated };
    }),
}));
