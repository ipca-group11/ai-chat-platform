import { describe, expect, it } from "vitest";
import { SSE_EVENT_TYPES, messageDtoSchema, sseEventSchema } from "./sse";

const message = {
  id: "msg-1",
  chatId: "chat-1",
  authorId: "user-1",
  authorEmail: "ana@example.com",
  role: "user",
  content: "hi",
  reasoning: null,
  webFetches: [],
  attachments: [],
  status: "sent",
  truncated: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("sseEventSchema", () => {
  it("AC-8: accepts a token event", () => {
    const result = sseEventSchema.safeParse({
      type: "token",
      messageId: "msg-1",
      token: "Hel",
    });
    expect(result.success).toBe(true);
  });

  it("AC-8: accepts a done event and rejects an unknown type", () => {
    expect(
      sseEventSchema.safeParse({ type: "done", messageId: "msg-1" }).success,
    ).toBe(true);
    expect(
      sseEventSchema.safeParse({ type: "unknown", messageId: "msg-1" }).success,
    ).toBe(false);
  });

  it("accepts done with stopped (AC-54) or truncated (AICHAT-212)", () => {
    expect(sseEventSchema.safeParse({ type: "done", messageId: "m", stopped: true }).success).toBe(true);
    expect(sseEventSchema.safeParse({ type: "done", messageId: "m", truncated: true }).success).toBe(true);
    expect(sseEventSchema.safeParse({ type: "done", messageId: "m", truncated: "yes" }).success).toBe(false);
  });

  it("AC-8: error events need the message and whether a retry may help", () => {
    expect(
      sseEventSchema.safeParse({ type: "error", messageId: "msg-1", message: "provider timeout", retryable: true }).success,
    ).toBe(true);
    expect(sseEventSchema.safeParse({ type: "error", messageId: "msg-1", message: "provider timeout" }).success).toBe(false);
  });

  it("accepts queued and started without a position, as the service sends them", () => {
    expect(sseEventSchema.safeParse({ type: "queued", messageId: "msg-1" }).success).toBe(true);
    expect(sseEventSchema.safeParse({ type: "started", messageId: "msg-1" }).success).toBe(true);
  });

  it("carries the full message DTO in a message event", () => {
    expect(sseEventSchema.safeParse({ type: "message", message }).success).toBe(true);
    expect(sseEventSchema.safeParse({ type: "message", message: { ...message, truncated: undefined } }).success).toBe(false);
    expect(messageDtoSchema.safeParse({ ...message, role: "tool" }).success).toBe(false);
  });

  it("accepts a web fetch progress event", () => {
    const result = sseEventSchema.safeParse({
      type: "web_fetch",
      messageId: "msg-1",
      fetch: { id: "f1", url: "https://example.com", status: "done", title: "Example" },
    });
    expect(result.success).toBe(true);
  });

  it("lists every event name conversation-service sends", () => {
    expect(SSE_EVENT_TYPES).toEqual(["message", "queued", "started", "token", "reasoning", "web_fetch", "done", "error"]);
  });
});
