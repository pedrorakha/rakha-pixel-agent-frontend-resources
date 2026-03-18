import { DiscordStatus } from "./discord";

export type CharacterState =
  | "typing"
  | "focused"
  | "drinking_coffee"
  | "sleeping"
  | "walking"
  | "idle"
  | "dancing";

export type AccessoryHat = "none" | "cap" | "beanie" | "tophat" | "crown" | "headband";
export type AccessoryGlasses = "none" | "round" | "square" | "sunglasses" | "monocle";

export interface Character {
  id: string;
  name: string;
  discordId: string;
  spriteSheet: string | null;
  deskId: string | null;
  gridX: number;
  gridY: number;
  targetX: number | null;
  targetY: number | null;
  state: CharacterState;
  direction: "left" | "right" | "up" | "down";
  color: string;
  animationFrame: number;
  animationTimer: number;
  hat: AccessoryHat;
  glasses: AccessoryGlasses;
  colorShirt: string;
  colorHair: string;
  colorSkin: string;
  jumpOffset: number;
  jumpTimer: number;
}

export interface AnimationDef {
  frames: number;
  speed: number;
  loop: boolean;
}

export const STATUS_TO_STATE: Record<DiscordStatus, CharacterState> = {
  online: "typing",
  dnd: "focused",
  idle: "drinking_coffee",
  offline: "sleeping",
};

export const CHARACTER_ANIMATIONS: Record<CharacterState, AnimationDef> = {
  typing: { frames: 4, speed: 150, loop: true },
  focused: { frames: 2, speed: 500, loop: true },
  drinking_coffee: { frames: 4, speed: 300, loop: true },
  sleeping: { frames: 2, speed: 800, loop: true },
  walking: { frames: 4, speed: 100, loop: true },
  idle: { frames: 2, speed: 600, loop: true },
  dancing: { frames: 4, speed: 180, loop: true },
};
