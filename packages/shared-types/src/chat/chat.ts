import { z } from "zod";
import { providerSelectionSchema } from "./provider";

export const chatSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string().min(1).max(200),
  provider: providerSelectionSchema.shape.provider,
  model: providerSelectionSchema.shape.model,
  /** Reasoning ("thinking") requested for this chat's model, when the model supports it. */
  reasoning: z.boolean(),
  /** Web fetch allowed for this chat's model, when the model supports it. */
  webFetch: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Chat = z.infer<typeof chatSchema>;

/** `POST /chats` body (FR4). */
export const createChatRequestSchema = z.object({
  title: z.string().min(1).max(200),
  provider: providerSelectionSchema.shape.provider,
  model: providerSelectionSchema.shape.model,
  reasoning: z.boolean().optional(),
  webFetch: z.boolean().optional(),
});
export type CreateChatRequest = z.infer<typeof createChatRequestSchema>;

/** `PATCH /chats/:id` body (FR4, FR6 — rename and/or change provider/model/reasoning/web fetch). */
export const updateChatRequestSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    provider: providerSelectionSchema.shape.provider.optional(),
    model: providerSelectionSchema.shape.model.optional(),
    reasoning: z.boolean().optional(),
    webFetch: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateChatRequest = z.infer<typeof updateChatRequestSchema>;

/** `POST /chats/:id/members` body — owner invites a user by email. */
export const addChatMemberRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type AddChatMemberRequest = z.infer<typeof addChatMemberRequestSchema>;

/** `GET /chats/:id/members` entry. The owner is listed first with role `owner`. */
export const chatMemberSchema = z.object({
  email: z.string().nullable(),
  role: z.enum(["owner", "member"]),
  addedAt: z.string().datetime(),
});
export type ChatMember = z.infer<typeof chatMemberSchema>;
