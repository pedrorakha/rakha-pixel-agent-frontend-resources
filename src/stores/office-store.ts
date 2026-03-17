"use client";

import { create } from "zustand";
import { Desk, Furniture } from "@/types/office";
import {
  DEFAULT_DESKS,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  OFFICE_LAYOUT,
  GRID_WIDTH,
  GRID_HEIGHT,
} from "@/lib/constants";

interface OfficeState {
  layout: number[][];
  desks: Desk[];
  furniture: Furniture[];
  zoom: number;
  cameraX: number;
  cameraY: number;
  gridWidth: number;
  gridHeight: number;
  isPanning: boolean;
  panStartX: number;
  panStartY: number;

  setLayout: (layout: number[][]) => void;
  setDesks: (desks: Desk[]) => void;
  addDesk: (desk: Desk) => void;
  removeDesk: (deskId: string) => void;
  updateDesk: (deskId: string, updates: Partial<Desk>) => void;
  setFurniture: (furniture: Furniture[]) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (zoom: number) => void;
  setCamera: (x: number, y: number) => void;
  panCamera: (dx: number, dy: number) => void;
  startPan: (x: number, y: number) => void;
  endPan: () => void;
  updatePan: (x: number, y: number) => void;
}

export const useOfficeStore = create<OfficeState>((set, get) => ({
  layout: OFFICE_LAYOUT,
  desks: DEFAULT_DESKS,
  furniture: [],
  zoom: DEFAULT_ZOOM,
  cameraX: 0,
  cameraY: 0,
  gridWidth: GRID_WIDTH,
  gridHeight: GRID_HEIGHT,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,

  setLayout: (layout) => set({ layout }),
  setDesks: (desks) => set({ desks }),
  addDesk: (desk) => set((state) => ({ desks: [...state.desks, desk] })),
  removeDesk: (deskId) =>
    set((state) => ({
      desks: state.desks.filter((d) => d.id !== deskId),
    })),
  updateDesk: (deskId, updates) =>
    set((state) => ({
      desks: state.desks.map((d) =>
        d.id === deskId ? { ...d, ...updates } : d
      ),
    })),
  setFurniture: (furniture) => set({ furniture }),

  zoomIn: () =>
    set((state) => ({
      zoom: Math.min(MAX_ZOOM, state.zoom + ZOOM_STEP),
    })),
  zoomOut: () =>
    set((state) => ({
      zoom: Math.max(MIN_ZOOM, state.zoom - ZOOM_STEP),
    })),
  setZoom: (zoom) =>
    set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),

  setCamera: (x, y) => set({ cameraX: x, cameraY: y }),
  panCamera: (dx, dy) =>
    set((state) => ({
      cameraX: state.cameraX + dx,
      cameraY: state.cameraY + dy,
    })),

  startPan: (x, y) =>
    set({
      isPanning: true,
      panStartX: x,
      panStartY: y,
    }),
  endPan: () => set({ isPanning: false }),
  updatePan: (x, y) => {
    const state = get();
    if (!state.isPanning) return;
    const dx = (state.panStartX - x) / state.zoom;
    const dy = (state.panStartY - y) / state.zoom;
    set({
      cameraX: state.cameraX + dx,
      cameraY: state.cameraY + dy,
      panStartX: x,
      panStartY: y,
    });
  },
}));
