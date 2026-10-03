import { z } from "zod";
import { webFetchSchema } from "./message";

/**
 * Server-Sent Event shapes streamed from `GET /chats/:id/stream` (ARCHITECTURE.md §5).
 * Discriminated on `type` so clients can narrow with a switch.
 */
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

export const sseDoneEventSchema = z.object({
  type: z.literal("done"),
  messageId: z.string(),
});
export type SseDoneEvent = z.infer<typeof sseDoneEventSchema>;

export const sseErrorEventSchema = z.object({
  type: z.literal("error"),
  messageId: z.string(),
  message: z.string(),
});
export type SseErrorEvent = z.infer<typeof sseErrorEventSchema>;

export const sseQueuedEventSchema = z.object({
  type: z.literal("queued"),
  messageId: z.string(),
  position: z.number().int().nonnegative(),
});
export type SseQueuedEvent = z.infer<typeof sseQueuedEventSchema>;

export const sseEventSchema = z.discriminatedUnion("type", [
  sseTokenEventSchema,
  sseReasoningEventSchema,
  sseWebFetchEventSchema,
  sseDoneEventSchema,
  sseErrorEventSchema,
  sseQueuedEventSchema,
]);
export type SseEvent = z.infer<typeof sseEventSchema>;
