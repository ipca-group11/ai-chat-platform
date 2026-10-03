import { describe, expect, it } from "vitest";

import {
  LLM_API_KEY_HEADER,
  PROVIDERS,
  PROVIDERS_REQUIRING_KEY,
  PROVIDERS_WITHOUT_KEY,
  providerRequiresApiKey,
  providerSchema,
  storedApiKeyRecordSchema,
} from "./schema";

describe("providerSchema", () => {
  it("AC-76: accepts openai and anthropic as valid providers", () => {
    expect(providerSchema.parse("openai")).toBe("openai");
    expect(providerSchema.parse("anthropic")).toBe("anthropic");
  });

  it("AC-77: accepts ollama as a valid provider", () => {
    expect(providerSchema.parse("ollama")).toBe("ollama");
  });

  it("AC-76: rejects an unknown provider", () => {
    expect(() => providerSchema.parse("cohere")).toThrow();
  });

  it("lists exactly the three supported providers", () => {
    expect(PROVIDERS).toEqual(["openai", "anthropic", "ollama"]);
  });
});

describe("providerRequiresApiKey", () => {
  it("AC-76: openai and anthropic require a key", () => {
    expect(providerRequiresApiKey("openai")).toBe(true);
    expect(providerRequiresApiKey("anthropic")).toBe(true);
    expect(PROVIDERS_REQUIRING_KEY).toEqual(["openai", "anthropic"]);
  });

  it("AC-77: ollama does not require a key", () => {
    expect(providerRequiresApiKey("ollama")).toBe(false);
    expect(PROVIDERS_WITHOUT_KEY).toEqual(["ollama"]);
  });
});

describe("storedApiKeyRecordSchema", () => {
  it("AC-79: accepts a record containing only provider, last4, and createdAt (never a raw key)", () => {
    const record = storedApiKeyRecordSchema.parse({
      provider: "openai",
      last4: "a1b2",
      createdAt: new Date().toISOString(),
    });
    expect(record).toEqual({
      provider: "openai",
      last4: "a1b2",
      createdAt: expect.any(String),
    });
    expect(Object.keys(record).sort()).toEqual(["createdAt", "last4", "provider"]);
  });

  it("AC-79: rejects a record that smuggles a raw key-like field beyond schema shape by stripping it", () => {
    const parsed = storedApiKeyRecordSchema.parse({
      provider: "openai",
      last4: "a1b2",
      createdAt: new Date().toISOString(),
      rawKey: "sk-super-secret-value",
    });
    expect(parsed).not.toHaveProperty("rawKey");
  });

  it("rejects a last4 value longer than 4 characters", () => {
    expect(() =>
      storedApiKeyRecordSchema.parse({
        provider: "openai",
        last4: "abcde",
        createdAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("rejects a missing createdAt", () => {
    expect(() =>
      storedApiKeyRecordSchema.parse({ provider: "openai", last4: "a1b2" }),
    ).toThrow();
  });
});

describe("LLM_API_KEY_HEADER", () => {
  it("AC-81: exposes a stable header name constant", () => {
    expect(LLM_API_KEY_HEADER).toBe("X-Llm-Api-Key");
  });
});
