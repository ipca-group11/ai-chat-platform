import { describe, expect, it } from "vitest";
import {
  attachmentKindSchema,
  chatDtoSchema,
  chatMemberDtoSchema,
  messageDtoSchema,
  messageStatusSchema,
  providerSchema,
  sseDoneEventSchema,
  sseErrorEventSchema,
  sseMessageEventSchema,
  sseTokenEventSchema,
  sseWebFetchEventSchema,
  webFetchDtoSchema,
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

describe("SSE event schemas", () => {
  it("discriminates on the literal type", () => {
    expect(sseTokenEventSchema.safeParse({ type: "token", messageId: "m", token: "a" }).success).toBe(true);
    expect(sseTokenEventSchema.safeParse({ type: "done", messageId: "m", token: "a" }).success).toBe(false);
  });

  it("allows done with or without stopped", () => {
    expect(sseDoneEventSchema.safeParse({ type: "done", messageId: "m" }).success).toBe(true);
    expect(sseDoneEventSchema.safeParse({ type: "done", messageId: "m", stopped: true }).success).toBe(true);
  });

  it("allows done with truncated (AICHAT-212)", () => {
    expect(sseDoneEventSchema.safeParse({ type: "done", messageId: "m", truncated: true }).success).toBe(true);
    expect(sseDoneEventSchema.safeParse({ type: "done", messageId: "m", truncated: "yes" }).success).toBe(false);
  });

  it("requires retryable on error events", () => {
    expect(sseErrorEventSchema.safeParse({ type: "error", messageId: "m", message: "x" }).success).toBe(false);
    expect(sseErrorEventSchema.safeParse({ type: "error", messageId: "m", message: "x", retryable: false }).success).toBe(true);
  });

  it("nests full DTOs in message and web_fetch events", () => {
    expect(sseMessageEventSchema.safeParse({ type: "message", message }).success).toBe(true);
    expect(
      sseWebFetchEventSchema.safeParse({ type: "web_fetch", messageId: "m", fetch: { id: "f", url: "u", status: "fetching" } }).success,
    ).toBe(true);
  });
});
