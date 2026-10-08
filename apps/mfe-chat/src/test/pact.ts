import { correlationHeaderMatcher, like, term } from "@platform/pact-config";

// Shared pieces of the mfe-chat -> conversation-service pacts (AICHAT-179). Bodies hold
// only the fields this app reads (`shared/types.ts`); the provider may send more.

export const CHAT_ID = "chat-1";
export const MESSAGE_ID = "msg-1";

export const correlation = { "X-Correlation-Id": correlationHeaderMatcher() };
export const jsonRequest = { ...correlation, "Content-Type": "application/json" };

const isoDate = term("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z", "2026-10-08T10:00:00.000Z");

export const chatBody = {
  id: like(CHAT_ID),
  title: like("Trip plan"),
  ownerId: like("user-1"),
  provider: term("anthropic|openai|ollama", "anthropic"),
  model: like("claude-haiku-4-5"),
  createdAt: isoDate,
  updatedAt: isoDate,
};

export function messageBody(overrides: Record<string, unknown> = {}) {
  return {
    id: like(MESSAGE_ID),
    chatId: like(CHAT_ID),
    role: term("user|assistant", "user"),
    content: like("Hello"),
    attachments: [],
    status: term("sent|queued|streaming|failed", "sent"),
    stopped: like(false),
    createdAt: isoDate,
    ...overrides,
  };
}

export const memberBody = {
  email: like("bob@example.com"),
  role: term("owner|member", "member"),
  addedAt: isoDate,
};

export const attachmentBody = {
  id: like("att-1"),
  messageId: like(MESSAGE_ID),
  filename: like("notes.txt"),
  mimeType: like("text/plain"),
  size: like(27),
  kind: term("text|pdf|image", "text"),
};
