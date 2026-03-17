"use client";

import { useEffect, useRef, useCallback } from "react";
import { GameLoop, UpdateCallback, RenderCallback } from "@/engine/game-loop";

interface UseGameLoopOptions {
  targetFps?: number;
  autoStart?: boolean;
}

export function useGameLoop(
  updateFn: UpdateCallback,
  renderFn: RenderCallback,
  options: UseGameLoopOptions = {}
) {
  const { targetFps = 60, autoStart = true } = options;
  const gameLoopRef = useRef<GameLoop | null>(null);
  const updateRef = useRef<UpdateCallback>(updateFn);
  const renderRef = useRef<RenderCallback>(renderFn);

  // Keep callbacks fresh without restarting the loop
  useEffect(() => {
    updateRef.current = updateFn;
  }, [updateFn]);

  useEffect(() => {
    renderRef.current = renderFn;
  }, [renderFn]);

  useEffect(() => {
    const loop = new GameLoop(
      (dt, t) => updateRef.current(dt, t),
      (dt, t) => renderRef.current(dt, t),
      targetFps
    );
    gameLoopRef.current = loop;

    if (autoStart) {
      loop.start();
    }

    return () => {
      loop.stop();
      gameLoopRef.current = null;
    };
  }, [targetFps, autoStart]);

  const start = useCallback(() => {
    gameLoopRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    gameLoopRef.current?.stop();
  }, []);

  return { start, stop, gameLoopRef };
}
