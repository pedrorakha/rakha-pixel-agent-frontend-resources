export interface Sprite {
  image: HTMLImageElement | null;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  loaded: boolean;
}

export interface SpriteFrame {
  row: number;
  col: number;
}

export interface AnimationFrame {
  spriteFrame: SpriteFrame;
  duration: number;
}

export interface Animation {
  name: string;
  frames: AnimationFrame[];
  loop: boolean;
}

export interface TileData {
  type: TileType;
  walkable: boolean;
  color: string;
}

export type TileType = "floor" | "floor_alt" | "wall" | "wall_top" | "empty";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface GameState {
  camera: Camera;
  deltaTime: number;
  time: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface RenderLayer {
  zIndex: number;
  render: (ctx: CanvasRenderingContext2D, state: GameState) => void;
}
