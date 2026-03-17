export type UpdateCallback = (deltaTime: number, time: number) => void;
export type RenderCallback = (deltaTime: number, time: number) => void;

export class GameLoop {
  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  private running = false;
  private updateFn: UpdateCallback;
  private renderFn: RenderCallback;
  private targetFps: number;
  private frameInterval: number;
  private accumulator = 0;

  constructor(
    updateFn: UpdateCallback,
    renderFn: RenderCallback,
    targetFps = 60
  ) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.targetFps = targetFps;
    this.frameInterval = 1000 / targetFps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    this.tick(this.lastTimestamp);
  }

  stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  setTargetFps(fps: number): void {
    this.targetFps = fps;
    this.frameInterval = 1000 / fps;
  }

  private tick = (timestamp: number): void => {
    if (!this.running) return;

    this.animationFrameId = requestAnimationFrame(this.tick);

    const elapsed = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Cap delta time to avoid spiral of death
    const cappedElapsed = Math.min(elapsed, 100);
    this.accumulator += cappedElapsed;

    while (this.accumulator >= this.frameInterval) {
      this.updateFn(this.frameInterval / 1000, timestamp / 1000);
      this.accumulator -= this.frameInterval;
    }

    this.renderFn(elapsed / 1000, timestamp / 1000);
  };
}
