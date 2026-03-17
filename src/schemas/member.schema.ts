import { z } from "zod";

export const memberSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  discordId: z.string().min(1),
  characterSprite: z.string().nullable(),
  deskId: z.string().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createMemberSchema = z.object({
  name: z.string().min(1).max(50),
  discordId: z.string().min(1),
  characterSprite: z.string().nullable().optional(),
  deskId: z.string().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const updateMemberSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  discordId: z.string().min(1).optional(),
  characterSprite: z.string().nullable().optional(),
  deskId: z.string().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export type Member = z.infer<typeof memberSchema>;
export type CreateMember = z.infer<typeof createMemberSchema>;
export type UpdateMember = z.infer<typeof updateMemberSchema>;
