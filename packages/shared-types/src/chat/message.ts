import { z } from "zod";
import { webFetchSchema } from "../stream-events";

export const messageRoleSchema = z.enum(["user", "assistant"]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

/** Lifecycle of a message through the per-chat FIFO queue (FR11, UC4). */
export const messageStatusSchema = z.enum([
  "queued",
  "streaming",
  "complete",
  "failed",
  "canceled",
]);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

/** A page the model fetched while writing a reply (`fetching` only while streaming). */
export { webFetchSchema, type WebFetch } from "../stream-events";

export const messageSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  /** The model's reasoning for an assistant reply, when reasoning was on. */
  reasoning: z.string().nullable().optional(),
  /** Pages the model fetched for an assistant reply, when web fetch was on. */
  webFetches: z.array(webFetchSchema).optional(),
  status: messageStatusSchema,
  attachmentIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof messageSchema>;

/** `POST /chats/:id/messages` body (FR9, UC3). */
export const sendMessageRequestSchema = z.object({
  content: z.string().min(1),
  attachmentIds: z.array(z.string()).optional(),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

/** `PATCH /chats/:id/messages/:messageId` body — edit a still-queued message (FR11). */
export const editQueuedMessageRequestSchema = z.object({
  content: z.string().min(1),
});
export type EditQueuedMessageRequest = z.infer<typeof editQueuedMessageRequestSchema>;
