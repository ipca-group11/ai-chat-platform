import * as streamEvents from "@app/shared-types/stream-events";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  attachmentDtoSchema,
  attachmentKindSchema,
  chatDtoSchema,
  chatMemberDtoSchema,
  messageDtoSchema,
  messageStatusSchema,
  providerSchema,
  webFetchDtoSchema,
  type SseEvent,
} from "./chat.js";

const now = "2026-01-01T00:00:00.000Z";

const message = {
  id: "m1",
  chatId: "c1",
  authorId: "u1",
  authorEmail: null,
  role: "assistant" as const,
  content: "hi",
  reasoning: null,
  webFetches: [],
  attachments: [],
  status: "sent" as const,
  truncated: false,
  createdAt: now,
};

describe("enums", () => {
  it.each([
    [providerSchema, ["openai", "anthropic"], "gemini"],
    [messageStatusSchema, ["sent", "queued", "streaming", "failed"], "done"],
    [attachmentKindSchema, ["text", "pdf", "image"], "video"],
  ])("accepts only the agreed values", (schema, valid, invalid) => {
    for (const value of valid) expect(schema.safeParse(value).success).toBe(true);
    expect(schema.safeParse(invalid).success).toBe(false);
  });
});

describe("DTO schemas", () => {
  it("accepts a message with every optional part empty and keeps error optional", () => {
    expect(messageDtoSchema.safeParse(message).success).toBe(true);
    expect(messageDtoSchema.safeParse({ ...message, error: null }).success).toBe(true);
  });

  it("requires the truncated flag on a message (AICHAT-212)", () => {
    expect(messageDtoSchema.safeParse({ ...message, truncated: true }).success).toBe(true);
    expect(messageDtoSchema.safeParse({ ...message, truncated: undefined }).success).toBe(false);
  });

  it("rejects a message with an unknown role or a missing author", () => {
    expect(messageDtoSchema.safeParse({ ...message, role: "tool" }).success).toBe(false);
    expect(messageDtoSchema.safeParse({ ...message, authorId: undefined }).success).toBe(false);
  });

  it("requires boolean reasoning and webFetch flags on a chat", () => {
    const chat = {
      id: "c1", title: "t", ownerId: "u1", ownerEmail: "a@b.pt", provider: "openai", model: "gpt-5",
      reasoning: true, webFetch: false, createdAt: now, updatedAt: now,
    };
    expect(chatDtoSchema.safeParse(chat).success).toBe(true);
    expect(chatDtoSchema.safeParse({ ...chat, reasoning: "yes" }).success).toBe(false);
  });

  it("accepts a member with a null email (legacy owner) and rejects unknown roles", () => {
    expect(chatMemberDtoSchema.safeParse({ email: null, role: "owner", addedAt: now }).success).toBe(true);
    expect(chatMemberDtoSchema.safeParse({ email: "a@b.pt", role: "admin", addedAt: now }).success).toBe(false);
  });

  it("limits web fetch status and keeps title and errorCode optional", () => {
    expect(webFetchDtoSchema.safeParse({ id: "f", url: "https://x.pt", status: "done" }).success).toBe(true);
    expect(webFetchDtoSchema.safeParse({ id: "f", url: "https://x.pt", status: "lost" }).success).toBe(false);
  });
});

describe("stream events (AICHAT-221)", () => {
  it("carry the same message, attachment and web fetch shapes as the service DTOs", () => {
    expect(z.toJSONSchema(messageDtoSchema)).toEqual(z.toJSONSchema(streamEvents.messageDtoSchema));
    expect(z.toJSONSchema(attachmentDtoSchema)).toEqual(z.toJSONSchema(streamEvents.attachmentDtoSchema));
    expect(z.toJSONSchema(webFetchDtoSchema)).toEqual(z.toJSONSchema(streamEvents.webFetchSchema));
  });

  it("accept every event the service publishes", () => {
    const events: SseEvent[] = [
      { type: "message", message },
      { type: "queued", messageId: "m" },
      { type: "started", messageId: "m" },
      { type: "token", messageId: "m", token: "a" },
      { type: "reasoning", messageId: "m", token: "a" },
      { type: "web_fetch", messageId: "m", fetch: { id: "f", url: "u", status: "fetching" } },
      { type: "done", messageId: "m", stopped: true },
      { type: "done", messageId: "m", truncated: true },
      { type: "error", messageId: "m", message: "x", retryable: false },
    ];
    for (const event of events) expect(streamEvents.sseEventSchema.safeParse(event).success).toBe(true);
  });
});
