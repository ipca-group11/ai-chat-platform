import { z } from "zod";

/**
 * Local mirror of the `packages/shared-types/src/chat/*` module this pod proposes to
 * add (platform-owned package, see PLAN.md §2). Mirrors the exact shape so call sites
 * can switch to `import { chat } from "@shared-types"` once the package lands.
 */

export const providerSchema = z.enum(["ollama", "openai", "anthropic"]);
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
  /** The model stopped at its output token limit, so the answer is cut off (AICHAT-212). */
  truncated: z.boolean(),
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
// The stream events are defined once, in `@app/shared-types/stream-events` (AICHAT-221), and
// imported as types only: the runtime image does not ship the package's own dependencies.
// `chat.spec.ts` checks that the DTO schemas above match the ones the events carry.
export type {
  SseEvent,
  SseEventType,
  SseMessageEvent,
  SseQueuedEvent,
  SseStartedEvent,
  SseTokenEvent,
  SseReasoningEvent,
  SseWebFetchEvent,
  SseDoneEvent,
  SseErrorEvent,
} from "@app/shared-types/stream-events";
