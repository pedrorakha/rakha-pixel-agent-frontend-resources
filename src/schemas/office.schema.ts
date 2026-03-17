import { z } from "zod";
import { deskSchema } from "./desk.schema";

export const furnitureTypeSchema = z.enum([
  "desk",
  "chair",
  "bed",
  "coffee_machine",
  "plant",
  "bookshelf",
  "whiteboard",
  "couch",
  "table",
  "wall_decoration",
]);

export const furnitureSchema = z.object({
  id: z.string(),
  type: furnitureTypeSchema,
  gridX: z.number().int().min(0),
  gridY: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

export const officeSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  width: z.number().int().min(10).max(100),
  height: z.number().int().min(10).max(100),
  desks: z.array(deskSchema),
  furniture: z.array(furnitureSchema),
});

export const officeLayoutSchema = z.object({
  tiles: z.array(z.array(z.number().int().min(0))),
  collisionMap: z.array(z.array(z.boolean())),
});

export type FurnitureSchema = z.infer<typeof furnitureSchema>;
export type OfficeSchema = z.infer<typeof officeSchema>;
export type OfficeLayoutSchema = z.infer<typeof officeLayoutSchema>;
