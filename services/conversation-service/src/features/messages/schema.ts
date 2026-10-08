import { z } from "zod";

/** Request bodies are strict: an unknown field is refused with 400 (AICHAT-186). */
export const sendMessageSchema = z.strictObject({
  content: z.string().trim().min(1, "Message content is required").max(32_000),
  attachmentIds: z.array(z.string().min(1)).max(10).default([]),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const editMessageSchema = z.strictObject({
  content: z.string().trim().min(1, "Message content is required").max(32_000),
});
export type EditMessageInput = z.infer<typeof editMessageSchema>;

export const chatParamsSchema = z.object({
  chatId: z.string().min(1),
});

export const messageParamsSchema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1),
});
