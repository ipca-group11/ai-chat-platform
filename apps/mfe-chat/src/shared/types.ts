/**
 * Chat domain DTOs / SSE event types.
 *
 * These mirror the contracts proposed to `packages/shared-types` by this pod
 * (see docs/pods/chat/PLAN.md §2). `packages/shared-types` does not exist yet in
 * this worktree (owned by the `platform` pod), so they are defined locally here
 * for now. At integration time this file should be deleted and its exports
 * replaced with imports from `@app/shared-types` — no other file in this app
 * should re-declare these shapes, so that swap is a one-line change per import.
 */

export type Provider = "openai" | "anthropic";

export const PROVIDERS: readonly Provider[] = ["anthropic", "openai"];

export const PROVIDER_MODELS: Record<Provider, readonly string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-5-mini", "o4-mini"],
  anthropic: [
    "claude-opus-5-5",
    "claude-sonnet-5-5",
    "claude-haiku-4-5",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
  ],
};

export interface Chat {
  id: string;
  title: string;
  ownerId: string;
  /** Null for chats created before sharing existed. */
  ownerEmail?: string | null;
  provider: Provider;
  model: string;
  /** Reasoning ("thinking") requested for the model; only applied when `supportsReasoning`. */
  reasoning?: boolean;
  /** Let the model fetch pages behind URLs in the chat; only applied when `supportsWebFetch`. */
  webFetch?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "user" | "assistant";

/**
 * `sent`: persisted, not queued/streaming (user messages land here immediately;
 * assistant messages land here once the response is complete).
 * `queued`: waiting behind another in-flight message in this chat's FIFO queue.
 * `streaming`: the provider is actively producing tokens for this message.
 * `failed`: the provider call errored, timed out, or was rate-limited.
 */
export type MessageStatus = "sent" | "queued" | "streaming" | "failed";

export interface Message {
  id: string;
  chatId: string;
  /** Who wrote it (for assistant replies: the chat owner). */
  authorId?: string;
  /** Null for assistant replies and messages from before chat sharing. */
  authorEmail?: string | null;
  role: MessageRole;
  content: string;
  /** The model's reasoning ("thinking") for an assistant reply; null/absent when there is none. */
  reasoning?: string | null;
  /** Pages the model fetched for an assistant reply, in the order it fetched them. */
  webFetches?: WebFetch[];
  attachments: Attachment[];
  status: MessageStatus;
  /** Provider error text, set when `status` is `failed` (conversation-service `MessageDto.error`). */
  error?: string | null;
  createdAt: string;
}

/** A page the model fetched while writing a reply (conversation-service `WebFetchDto`).
 * `fetching` only while the reply streams; saved replies hold `done` or `error`. */
export interface WebFetch {
  id: string;
  url: string;
  status: "fetching" | "done" | "error";
  title?: string;
  /** Why the fetch failed, e.g. `url_not_accessible`. */
  errorCode?: string;
}

export type ChatMemberRole = "owner" | "member";

/** Entry of `GET /chats/:id/members`; the owner comes first. */
export interface ChatMember {
  /** Null only for the owner of a chat created before sharing existed. */
  email: string | null;
  role: ChatMemberRole;
  addedAt: string;
}

export type AttachmentKind = "text" | "pdf" | "image";

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
}

/** Events on `GET /chats/:id/stream`, as published by conversation-service
 * (services/conversation-service/src/shared/contracts/chat.ts `SseEvent`). */
export type SSEEvent =
  | { type: "message"; message: Message }
  | { type: "queued"; messageId: string }
  | { type: "started"; messageId: string }
  | { type: "token"; messageId: string; token: string }
  | { type: "reasoning"; messageId: string; token: string }
  | { type: "web_fetch"; messageId: string; fetch: WebFetch }
  | { type: "done"; messageId: string; stopped?: boolean }
  | { type: "error"; messageId: string; message: string; retryable: boolean };

/** `X-Correlation-Id` per docs/STACK.md decision #8 (defined by `platform`, reused here). */
export const CORRELATION_HEADER = "X-Correlation-Id";

/**
 * `X-Llm-Api-Key` per docs/ARCHITECTURE.md §6 (owned by the `settings` pod).
 * This pod only reads/forwards it on requests that call an LLM; it never
 * persists it. Exact header name/format to be confirmed with the settings pod
 * (flagged as an integration risk in docs/pods/chat/PLAN.md §7).
 */
export const LLM_API_KEY_HEADER = "X-Llm-Api-Key";
