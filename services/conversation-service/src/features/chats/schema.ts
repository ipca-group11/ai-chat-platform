import { z } from "zod";
import { providerSchema } from "../../shared/contracts/chat.js";

export const createChatSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  provider: providerSchema,
  model: z.string().trim().min(1, "Model is required").max(200),
  reasoning: z.boolean().optional(),
  webFetch: z.boolean().optional(),
});
export type CreateChatInput = z.infer<typeof createChatSchema>;

export const updateChatSchema = z
  .object({
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

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const memberParamsSchema = z.object({
  id: z.string().min(1),
  email: z.string().trim().toLowerCase().min(1),
});
