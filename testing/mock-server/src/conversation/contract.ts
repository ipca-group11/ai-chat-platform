import { z } from "zod";

/**
 * What conversation-service sends and accepts on the wire. The service keeps these schemas
 * in `services/conversation-service/src/shared/contracts/chat.ts` (its DTOs differ from the
 * records in `@app/shared-types`: author fields, `sent` status, attachment objects), so the
 * mock repeats them to build and check its responses.
 */
export const providerSchema = z.enum(["openai", "anthropic"]);

export const messageRoleSchema = z.enum(["user", "assistant", "system"]);
export const messageStatusSchema = z.enum(["sent", "queued", "streaming", "failed"]);
export const attachmentKindSchema = z.enum(["text", "pdf", "image"]);

export const attachmentDtoSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  kind: attachmentKindSchema,
  createdAt: z.string(),
});
export type AttachmentDto = z.infer<typeof attachmentDtoSchema>;

export const webFetchDtoSchema = z.object({
  id: z.string(),
  url: z.string(),
  status: z.enum(["fetching", "done", "error"]),
  title: z.string().optional(),
  errorCode: z.string().optional(),
});
export type WebFetchDto = z.infer<typeof webFetchDtoSchema>;

export const messageDtoSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  authorId: z.string(),
  authorEmail: z.string().nullable(),
  role: messageRoleSchema,
  content: z.string(),
  reasoning: z.string().nullable(),
  webFetches: z.array(webFetchDtoSchema),
  attachments: z.array(attachmentDtoSchema),
  status: messageStatusSchema,
  error: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type MessageDto = z.infer<typeof messageDtoSchema>;

export const chatDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerId: z.string(),
  ownerEmail: z.string().nullable(),
  provider: providerSchema,
  model: z.string(),
  reasoning: z.boolean(),
  webFetch: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatDto = z.infer<typeof chatDtoSchema>;

export const chatMemberDtoSchema = z.object({
  email: z.string().nullable(),
  role: z.enum(["owner", "member"]),
  addedAt: z.string(),
});
export type ChatMemberDto = z.infer<typeof chatMemberDtoSchema>;

/** Events of `GET /chats/:id/stream`. */
export const sseEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), message: messageDtoSchema }),
  z.object({ type: z.literal("queued"), messageId: z.string() }),
  z.object({ type: z.literal("started"), messageId: z.string() }),
  z.object({ type: z.literal("token"), messageId: z.string(), token: z.string() }),
  z.object({ type: z.literal("reasoning"), messageId: z.string(), token: z.string() }),
  z.object({ type: z.literal("web_fetch"), messageId: z.string(), fetch: webFetchDtoSchema }),
  z.object({ type: z.literal("done"), messageId: z.string(), stopped: z.boolean().optional() }),
  z.object({ type: z.literal("error"), messageId: z.string(), message: z.string(), retryable: z.boolean() }),
]);
export type SseEvent = z.infer<typeof sseEventSchema>;

// --- request bodies, as the service validates them ---------------------------------------
export const createChatSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  provider: providerSchema,
  model: z.string().trim().min(1, "Model is required").max(200),
  reasoning: z.boolean().optional(),
  webFetch: z.boolean().optional(),
});

export const updateChatSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    provider: providerSchema.optional(),
    model: z.string().trim().min(1).max(200).optional(),
    reasoning: z.boolean().optional(),
    webFetch: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided" });

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "Message content is required").max(32_000),
  attachmentIds: z.array(z.string().min(1)).max(10).default([]),
});

export const editMessageSchema = z.object({
  content: z.string().trim().min(1, "Message content is required").max(32_000),
});
