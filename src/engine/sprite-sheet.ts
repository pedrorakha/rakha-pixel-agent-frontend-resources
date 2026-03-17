import { Sprite, SpriteFrame } from "./types";

export class SpriteSheet {
  private sprite: Sprite;

  constructor(frameWidth: number, frameHeight: number) {
    this.sprite = {
      image: null,
      frameWidth,
      frameHeight,
      columns: 0,
      rows: 0,
      loaded: false,
    };
  }

  async load(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sprite.image = img;
        this.sprite.columns = Math.floor(img.width / this.sprite.frameWidth);
        this.sprite.rows = Math.floor(img.height / this.sprite.frameHeight);
        this.sprite.loaded = true;
        resolve();
      };
      img.onerror = () => {
        reject(new Error(`Failed to load sprite sheet: ${src}`));
      };
      img.src = src;
    });
  }

  isLoaded(): boolean {
    return this.sprite.loaded;
  }

  getFrame(frame: SpriteFrame): {
    image: HTMLImageElement;
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  } | null {
    if (!this.sprite.image || !this.sprite.loaded) return null;

    return {
      image: this.sprite.image,
      sx: frame.col * this.sprite.frameWidth,
      sy: frame.row * this.sprite.frameHeight,
      sw: this.sprite.frameWidth,
      sh: this.sprite.frameHeight,
    };
  }

  drawFrame(
    ctx: CanvasRenderingContext2D,
    frame: SpriteFrame,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number
  ): void {
    const frameData = this.getFrame(frame);
    if (!frameData) return;

    ctx.drawImage(
      frameData.image,
      frameData.sx,
      frameData.sy,
      frameData.sw,
      frameData.sh,
      dx,
      dy,
      dw ?? this.sprite.frameWidth,
      dh ?? this.sprite.frameHeight
    );
  }

  getFrameWidth(): number {
    return this.sprite.frameWidth;
  }

  getFrameHeight(): number {
    return this.sprite.frameHeight;
  }

  getColumns(): number {
    return this.sprite.columns;
  }

  getRows(): number {
    return this.sprite.rows;
  }
}
