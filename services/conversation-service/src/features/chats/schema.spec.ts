import { describe, expect, it } from "vitest";
import { createChatSchema, updateChatSchema } from "./schema.js";

describe("chats schema", () => {
  it("AC-48: accepts openai and anthropic as the provider on create", () => {
    for (const provider of ["openai", "anthropic"] as const) {
      const result = createChatSchema.safeParse({ title: "Chat", provider, model: "some-model" });
      expect(result.success).toBe(true);
    }
  });

  it("AC-48: rejects an unknown provider", () => {
    const result = createChatSchema.safeParse({ title: "Chat", provider: "unknown", model: "some-model" });
    expect(result.success).toBe(false);
  });

  it("AC-42: rejects an empty title", () => {
    const result = createChatSchema.safeParse({ title: "", provider: "anthropic", model: "claude-haiku-4-5" });
    expect(result.success).toBe(false);
  });

  it("AC-48: update schema accepts a partial provider/model change", () => {
    const result = updateChatSchema.safeParse({ provider: "openai", model: "gpt-4o-mini" });
    expect(result.success).toBe(true);
  });

  it("AC-48: update schema rejects an empty payload", () => {
    const result = updateChatSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
