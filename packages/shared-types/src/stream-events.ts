import { z } from "zod";

/**
 * Events of `GET /chats/:id/stream`, exactly as conversation-service sends them (AICHAT-221,
 * docs/AICHAT-20/SSE-DRIFT.md). The service publishes these types, mfe-chat parses them and the
 * mock server is checked against them, so the three can no longer drift apart.
 *
 * Self-contained on purpose (only `zod`, no relative imports): conversation-service loads the
 * compiled output of this file with plain Node ESM (`@app/shared-types/stream-events`), like
 * `model-capabilities.ts`.
 */

/** A page the model fetched while writing a reply. `fetching` only appears while the reply is
 * streaming; saved replies hold `done` or `error`. */
export const webFetchSchema = z.object({
  id: z.string(),
  url: z.string(),
  status: z.enum(["fetching", "done", "error"]),
  title: z.string().optional(),
  /** Why the fetch failed, e.g. `url_not_accessible`. */
  errorCode: z.string().optional(),
});
export type WebFetch = z.infer<typeof webFetchSchema>;

/** A file attached to a message, as conversation-service returns it. */
export const attachmentDtoSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  kind: z.enum(["text", "pdf", "image"]),
  createdAt: z.string(),
});
export type AttachmentDto = z.infer<typeof attachmentDtoSchema>;

/** A message as conversation-service returns it (and sends it in the `message` event). */
export const messageDtoSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  /** User who wrote the message (for assistant replies: the chat owner). */
  authorId: z.string(),
  /** Author's email; null for assistant replies and messages from before chat sharing. */
  authorEmail: z.string().nullable(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  /** The model's reasoning for an assistant reply; null when there is none. */
  reasoning: z.string().nullable(),
  /** Pages the model fetched for an assistant reply; empty when there are none. */
  webFetches: z.array(webFetchSchema),
  attachments: z.array(attachmentDtoSchema),
  /** `sent`: stored and not waiting; `queued`: waits behind another reply; `streaming`: being written;
   * `failed`: the provider failed (the reply can be retried). */
  status: z.enum(["sent", "queued", "streaming", "failed"]),
  /** Provider error text, set when `status` is `failed`. */
  error: z.string().nullable().optional(),
  /** The model stopped at its output token limit, so the answer is cut off (AICHAT-212). */
  truncated: z.boolean(),
  createdAt: z.string(),
});
export type MessageDto = z.infer<typeof messageDtoSchema>;

/** A user message was posted, so every member viewing the chat sees it live. */
export const sseMessageEventSchema = z.object({
  type: z.literal("message"),
  message: messageDtoSchema,
});
export type SseMessageEvent = z.infer<typeof sseMessageEventSchema>;

/** A message was sent while another reply was being written; it waits in the chat's queue. */
export const sseQueuedEventSchema = z.object({
  type: z.literal("queued"),
  messageId: z.string(),
});
export type SseQueuedEvent = z.infer<typeof sseQueuedEventSchema>;

/** The server picked a message up and created the (still empty) assistant reply `messageId`. */
export const sseStartedEventSchema = z.object({
  type: z.literal("started"),
  messageId: z.string(),
});
export type SseStartedEvent = z.infer<typeof sseStartedEventSchema>;

/** A piece of the answer text. */
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
  fetch: webFetchSchema,
});
export type SseWebFetchEvent = z.infer<typeof sseWebFetchEventSchema>;

/** The reply is saved. `stopped`: the user stopped it; `truncated`: the model hit its output token
 * limit and the answer is cut off (AICHAT-212). */
export const sseDoneEventSchema = z.object({
  type: z.literal("done"),
  messageId: z.string(),
  stopped: z.boolean().optional(),
  truncated: z.boolean().optional(),
});
export type SseDoneEvent = z.infer<typeof sseDoneEventSchema>;

/** The provider failed; the reply is saved as `failed` with what was written so far (AICHAT-211).
 * `retryable`: a retry may succeed (rate limit, overload, server error). */
export const sseErrorEventSchema = z.object({
  type: z.literal("error"),
  messageId: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});
export type SseErrorEvent = z.infer<typeof sseErrorEventSchema>;

export const sseEventSchema = z.discriminatedUnion("type", [
  sseMessageEventSchema,
  sseQueuedEventSchema,
  sseStartedEventSchema,
  sseTokenEventSchema,
  sseReasoningEventSchema,
  sseWebFetchEventSchema,
  sseDoneEventSchema,
  sseErrorEventSchema,
]);
export type SseEvent = z.infer<typeof sseEventSchema>;
export type SseEventType = SseEvent["type"];

/** Every event name, in the order of `sseEventSchema`. */
export const SSE_EVENT_TYPES: readonly SseEventType[] = sseEventSchema.options.map((option) => option.shape.type.value);
