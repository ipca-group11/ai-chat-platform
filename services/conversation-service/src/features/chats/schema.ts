import { z } from "zod";
import { providerSchema } from "../../shared/contracts/chat.js";

/** Request bodies are strict: an unknown field is refused with 400 (AICHAT-186). */

export const createChatSchema = z.strictObject({
  title: z.string().trim().min(1, "Title is required").max(200),
  provider: providerSchema,
  model: z.string().trim().min(1, "Model is required").max(200),
  reasoning: z.boolean().optional(),
  webFetch: z.boolean().optional(),
});
export type CreateChatInput = z.infer<typeof createChatSchema>;

export const updateChatSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    provider: providerSchema.optional(),
    model: z.string().trim().min(1).max(200).optional(),
    reasoning: z.boolean().optional(),
    webFetch: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided" });
export type UpdateChatInput = z.infer<typeof updateChatSchema>;

export const chatIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const addMemberSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const memberParamsSchema = z.object({
  id: z.string().min(1),
  email: z.string().trim().toLowerCase().min(1),
});
