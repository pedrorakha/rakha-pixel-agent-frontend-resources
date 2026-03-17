"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface CanvasSize {
  width: number;
  height: number;
}

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });

  const updateSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext("2d");
    if (context) {
      context.scale(dpr, dpr);
      context.imageSmoothingEnabled = false;
      setCtx(context);
    }

    setSize({ width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (context) {
      context.imageSmoothingEnabled = false;
      setCtx(context);
    }

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    const parent = canvas.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateSize]);

  return { canvasRef, ctx, size, updateSize };
}
