import { describe, expect, it } from "vitest";
import { SSE_EVENT_TYPES, messageDtoSchema, sseEventSchema } from "./stream-events";

const message = {
  id: "m1",
  chatId: "c1",
  authorId: "u1",
  authorEmail: null,
  role: "assistant",
  content: "Hello",
  reasoning: null,
  webFetches: [],
  attachments: [],
  status: "sent",
  error: null,
  truncated: false,
  createdAt: "2026-10-04T12:00:00.000Z",
};

describe("stream events (AICHAT-221)", () => {
  it("lists every event the service sends, once", () => {
    expect(SSE_EVENT_TYPES).toEqual(["message", "queued", "started", "token", "reasoning", "web_fetch", "done", "error"]);
  });

  it("parses each event by its type", () => {
    const events = [
      { type: "message", message },
      { type: "queued", messageId: "m1" },
      { type: "started", messageId: "m1" },
      { type: "token", messageId: "m1", token: "Hi" },
      { type: "reasoning", messageId: "m1", token: "Thinking" },
      { type: "web_fetch", messageId: "m1", fetch: { id: "f1", url: "https://example.com", status: "done" } },
      { type: "done", messageId: "m1", truncated: true },
      { type: "error", messageId: "m1", message: "Overloaded", retryable: true },
    ];
    for (const event of events) {
      expect(sseEventSchema.parse(event).type).toBe(event.type);
    }
  });

  it("rejects an event type the service does not send", () => {
    expect(sseEventSchema.safeParse({ type: "queued.position", messageId: "m1", position: 2 }).success).toBe(false);
  });

  it("requires the truncated flag on a message (AICHAT-212)", () => {
    const { truncated: _truncated, ...withoutFlag } = message;
    expect(messageDtoSchema.safeParse(withoutFlag).success).toBe(false);
    expect(messageDtoSchema.parse({ ...message, truncated: true }).truncated).toBe(true);
  });

  it("requires retryable on an error event (AICHAT-211)", () => {
    expect(sseEventSchema.safeParse({ type: "error", messageId: "m1", message: "Failed" }).success).toBe(false);
  });
});
