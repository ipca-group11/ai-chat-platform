import { describe, expect, it } from "vitest";
import { CORRELATION_HEADER, LLM_API_KEY_HEADER, PROVIDERS, PROVIDER_MODELS } from "./types";

describe("shared constants", () => {
  it("lists every provider once, each with at least one selectable model", () => {
    expect(new Set(PROVIDERS).size).toBe(PROVIDERS.length);
    expect([...PROVIDERS].sort()).toEqual(Object.keys(PROVIDER_MODELS).sort());
    for (const provider of PROVIDERS) expect(PROVIDER_MODELS[provider].length).toBeGreaterThan(0);
  });

  it("offers no model twice within a provider", () => {
    for (const provider of PROVIDERS) {
      expect(new Set(PROVIDER_MODELS[provider]).size).toBe(PROVIDER_MODELS[provider].length);
    }
  });

  it("uses the agreed header names", () => {
    expect(CORRELATION_HEADER).toBe("X-Correlation-Id");
    expect(LLM_API_KEY_HEADER).toBe("X-Llm-Api-Key");
  });
});
