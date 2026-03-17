import { z } from "zod";

export const deskDirectionSchema = z.enum(["north", "south", "east", "west"]);

export const deskSchema = z.object({
  id: z.string(),
  gridX: z.number().int().min(0),
  gridY: z.number().int().min(0),
  direction: deskDirectionSchema,
  label: z.string().min(1).max(30),
  assignedMemberId: z.string().nullable(),
});

export const createDeskSchema = z.object({
  gridX: z.number().int().min(0),
  gridY: z.number().int().min(0),
  direction: deskDirectionSchema,
  label: z.string().min(1).max(30),
  assignedMemberId: z.string().nullable().optional(),
});

export const updateDeskSchema = z.object({
  gridX: z.number().int().min(0).optional(),
  gridY: z.number().int().min(0).optional(),
  direction: deskDirectionSchema.optional(),
  label: z.string().min(1).max(30).optional(),
  assignedMemberId: z.string().nullable().optional(),
});

export type DeskSchema = z.infer<typeof deskSchema>;
export type CreateDesk = z.infer<typeof createDeskSchema>;
export type UpdateDesk = z.infer<typeof updateDeskSchema>;
