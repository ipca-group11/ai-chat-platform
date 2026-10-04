import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { SseEvent } from "../../shared/contracts/chat.js";
import { writeSseEvent } from "./sse.js";

// Wire output of the stream endpoint (docs/AICHAT-20, AICHAT-77): the exact
// `event:`/`data:` text a browser receives, one frame per event type. Ids and dates are
// normalised by the serializer from @platform/test-config.

const MESSAGE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

function frameOf(event: SseEvent): string {
  const write = vi.fn();
  writeSseEvent({ write } as unknown as Response, event);
  return write.mock.calls.map(([chunk]) => String(chunk)).join("");
}

describe("SSE frames", () => {
  it("writes one frame per event type", () => {
    const events: SseEvent[] = [
      { type: "queued", messageId: MESSAGE_ID },
      { type: "started", messageId: MESSAGE_ID },
      { type: "token", messageId: MESSAGE_ID, token: "Hel" },
      { type: "reasoning", messageId: MESSAGE_ID, token: "Thinking" },
      {
        type: "web_fetch",
        messageId: MESSAGE_ID,
        fetch: { id: "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b", url: "https://example.com", status: "fetching" },
      },
      { type: "done", messageId: MESSAGE_ID, stopped: true },
      { type: "error", messageId: MESSAGE_ID, message: "provider timeout", retryable: true },
    ];

    expect(events.map(frameOf)).toMatchSnapshot();
  });

  it("writes the message event with the full message DTO", () => {
    const frame = frameOf({
      type: "message",
      message: {
        id: MESSAGE_ID,
        chatId: "7d9e1f2a-3b4c-4d5e-8f60-718293a4b5c6",
        authorId: "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b",
        authorEmail: "ana@example.com",
        role: "user",
        content: "Hello",
        reasoning: null,
        webFetches: [],
        attachments: [],
        status: "sent",
        createdAt: "2026-10-03T09:15:30.000Z",
      },
    });

    expect(frame).toMatchSnapshot();
  });
});
