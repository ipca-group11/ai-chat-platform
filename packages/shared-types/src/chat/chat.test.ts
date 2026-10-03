import { describe, expect, it } from "vitest";
import { createChatRequestSchema, updateChatRequestSchema } from "./chat";

describe("createChatRequestSchema", () => {
  it("AC-8: accepts a title with a valid provider/model selection", () => {
    const result = createChatRequestSchema.safeParse({
      title: "My first chat",
      provider: "ollama",
      model: "llama3.2:1b",
    });
    expect(result.success).toBe(true);
  });

  it("AC-8: rejects an unknown provider", () => {
    const result = createChatRequestSchema.safeParse({
      title: "My chat",
      provider: "not-a-provider",
      model: "gpt-4",
    });
    expect(result.success).toBe(false);
  });

  it("AC-8: rejects an empty title", () => {
    const result = createChatRequestSchema.safeParse({
      title: "",
      provider: "openai",
      model: "gpt-4",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateChatRequestSchema", () => {
  it("AC-8: accepts a partial update with just a new title", () => {
    const result = updateChatRequestSchema.safeParse({ title: "Renamed" });
    expect(result.success).toBe(true);
  });

  it("AC-8: rejects an empty update payload", () => {
    const result = updateChatRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
