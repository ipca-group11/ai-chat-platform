import { describe, expect, it } from "vitest";
import {
  editQueuedMessageRequestSchema,
  messageSchema,
  messageStatusSchema,
  sendMessageRequestSchema,
} from "./message";

describe("messageSchema", () => {
  it("AC-8: accepts a well-formed message with defaulted attachmentIds", () => {
    const result = messageSchema.safeParse({
      id: "msg-1",
      chatId: "chat-1",
      role: "user",
      content: "Hello",
      status: "queued",
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.attachmentIds).toEqual([]);
  });

  it("AC-8: rejects an unknown role", () => {
    const result = messageSchema.safeParse({
      id: "msg-1",
      chatId: "chat-1",
      role: "system",
      content: "Hello",
      status: "queued",
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("AC-8: rejects an unknown status", () => {
    const result = messageStatusSchema.safeParse("archived");
    expect(result.success).toBe(false);
  });
});

describe("sendMessageRequestSchema", () => {
  it("AC-8: accepts non-empty content with optional attachmentIds", () => {
    const result = sendMessageRequestSchema.safeParse({
      content: "Hi there",
      attachmentIds: ["att-1"],
    });
    expect(result.success).toBe(true);
  });

  it("AC-8: rejects empty content", () => {
    const result = sendMessageRequestSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });
});

describe("editQueuedMessageRequestSchema", () => {
  it("AC-8: accepts a non-empty content edit", () => {
    const result = editQueuedMessageRequestSchema.safeParse({ content: "Edited" });
    expect(result.success).toBe(true);
  });

  it("AC-8: rejects empty content", () => {
    const result = editQueuedMessageRequestSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });
});
