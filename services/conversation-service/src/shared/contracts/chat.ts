import { z } from "zod";

/**
 * Local mirror of the `packages/shared-types/src/chat/*` module this pod proposes to
 * add (platform-owned package, see PLAN.md §2). Mirrors the exact shape so call sites
 * can switch to `import { chat } from "@shared-types"` once the package lands.
 */

export const providerSchema = z.enum(["openai", "anthropic"]);
export type Provider = z.infer<typeof providerSchema>;

export const messageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const messageStatusSchema = z.enum(["sent", "queued", "streaming", "failed"]);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

export const attachmentKindSchema = z.enum(["text", "pdf", "image"]);
export type AttachmentKind = z.infer<typeof attachmentKindSchema>;

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

/** A page the model fetched while writing a reply. `fetching` only appears while the
 * reply is streaming; saved replies hold `done` or `error`. */
export const webFetchDtoSchema = z.object({
  id: z.string(),
  url: z.string(),
  status: z.enum(["fetching", "done", "error"]),
  title: z.string().optional(),
  /** Why the fetch failed, e.g. `url_not_accessible`. */
  errorCode: z.string().optional(),
});
export type WebFetchDto = z.infer<typeof webFetchDtoSchema>;

export const messageDtoSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  /** User who wrote the message (for assistant replies: the chat owner). */
  authorId: z.string(),
  /** Author's email; null for assistant replies and messages from before chat sharing. */
  authorEmail: z.string().nullable(),
  role: messageRoleSchema,
  content: z.string(),
  /** The model's reasoning for an assistant reply; null when there is none. */
  reasoning: z.string().nullable(),
  /** Pages the model fetched for an assistant reply; empty when there are none. */
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
  /** Reasoning ("thinking") requested for this chat's model, when the model supports it. */
  reasoning: z.boolean(),
  /** Web fetch allowed for this chat's model, when the model supports it. */
  webFetch: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatDto = z.infer<typeof chatDtoSchema>;

export const chatMemberRoleSchema = z.enum(["owner", "member"]);
export type ChatMemberRole = z.infer<typeof chatMemberRoleSchema>;

export const chatMemberDtoSchema = z.object({
  /** Null only for the owner of a chat created before sharing existed. */
  email: z.string().nullable(),
  role: chatMemberRoleSchema,
  addedAt: z.string(),
});
export type ChatMemberDto = z.infer<typeof chatMemberDtoSchema>;

// --- SSE event payloads (GET /chats/:id/stream) -------------------------------------
export const sseTokenEventSchema = z.object({
  type: z.literal("token"),
  messageId: z.string(),
  token: z.string(),
});
export type SseTokenEvent = z.infer<typeof sseTokenEventSchema>;

/** A piece of the model's reasoning, streamed before (or between) the answer tokens. */
export const sseReasoningEventSchema = z.object({
  type: z.literal("reasoning"),
  messageId: z.string(),
  token: z.string(),
});
export type SseReasoningEvent = z.infer<typeof sseReasoningEventSchema>;

/** The model started fetching a page, or a fetch finished (same `fetch.id`). */
export const sseWebFetchEventSchema = z.object({
  type: z.literal("web_fetch"),
  messageId: z.string(),
  fetch: webFetchDtoSchema,
});
export type SseWebFetchEvent = z.infer<typeof sseWebFetchEventSchema>;

export const sseQueuedEventSchema = z.object({
  type: z.literal("queued"),
  messageId: z.string(),
});
export type SseQueuedEvent = z.infer<typeof sseQueuedEventSchema>;

export const sseStartedEventSchema = z.object({
  type: z.literal("started"),
  messageId: z.string(),
});
export type SseStartedEvent = z.infer<typeof sseStartedEventSchema>;

export const sseDoneEventSchema = z.object({
  type: z.literal("done"),
  messageId: z.string(),
  stopped: z.boolean().optional(),
});
export type SseDoneEvent = z.infer<typeof sseDoneEventSchema>;

export const sseErrorEventSchema = z.object({
  type: z.literal("error"),
  messageId: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});
export type SseErrorEvent = z.infer<typeof sseErrorEventSchema>;

/** A user message was posted, so every member viewing the chat sees it live. */
export const sseMessageEventSchema = z.object({
  type: z.literal("message"),
  message: messageDtoSchema,
});
export type SseMessageEvent = z.infer<typeof sseMessageEventSchema>;

export type SseEvent =
  | SseMessageEvent
  | SseTokenEvent
  | SseReasoningEvent
  | SseWebFetchEvent
  | SseQueuedEvent
  | SseStartedEvent
  | SseDoneEvent
  | SseErrorEvent;
