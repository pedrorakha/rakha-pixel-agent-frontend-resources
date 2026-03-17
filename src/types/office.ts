export interface Office {
  id: string;
  name: string;
  width: number;
  height: number;
  desks: Desk[];
  furniture: Furniture[];
}

export interface Desk {
  id: string;
  gridX: number;
  gridY: number;
  direction: DeskDirection;
  label: string;
  assignedMemberId: string | null;
}

export type DeskDirection = "north" | "south" | "east" | "west";

export interface Furniture {
  id: string;
  type: FurnitureType;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
}

export type FurnitureType =
  | "desk"
  | "chair"
  | "bed"
  | "coffee_machine"
  | "plant"
  | "bookshelf"
  | "whiteboard"
  | "couch"
  | "table"
  | "wall_decoration";

export interface OfficeLayout {
  tiles: number[][];
  collisionMap: boolean[][];
}
