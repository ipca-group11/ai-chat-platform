import { describe, expect, it } from "vitest";
import { LLM_API_KEY_HEADER, llmProviderSchema, providerSelectionSchema } from "./provider.js";

describe("llmProviderSchema", () => {
  it.each(["openai", "anthropic"])("accepts %s", (value) => {
    expect(llmProviderSchema.parse(value)).toBe(value);
  });

  it.each(["gemini", "OpenAI", "", 1, null])("rejects %j", (value) => {
    expect(llmProviderSchema.safeParse(value).success).toBe(false);
  });
});

describe("providerSelectionSchema", () => {
  it("accepts a provider with a model", () => {
    expect(providerSelectionSchema.parse({ provider: "anthropic", model: "claude-haiku-4-5" })).toEqual({
      provider: "anthropic",
      model: "claude-haiku-4-5",
    });
  });

  it("rejects an empty model and an unknown provider", () => {
    expect(providerSelectionSchema.safeParse({ provider: "openai", model: "" }).success).toBe(false);
    expect(providerSelectionSchema.safeParse({ provider: "x", model: "m" }).success).toBe(false);
    expect(providerSelectionSchema.safeParse({ provider: "openai" }).success).toBe(false);
  });
});

describe("LLM_API_KEY_HEADER", () => {
  it("is the header the browser sends the per-request key in", () => {
    expect(LLM_API_KEY_HEADER).toBe("X-Llm-Api-Key");
  });
});
