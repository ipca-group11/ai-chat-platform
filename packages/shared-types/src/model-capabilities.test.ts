import { describe, expect, it } from "vitest";
import {
  PROVIDERS,
  PROVIDER_MODELS,
  THINKING_STYLES,
  WEB_FETCH_TOOLS,
  supportsReasoning,
  supportsVision,
  supportsWebFetch,
  thinkingStyle,
  webFetchToolType,
} from "./model-capabilities";

describe("model catalogue", () => {
  it("lists at least one model per provider, without duplicates", () => {
    expect([...PROVIDERS].sort()).toEqual(Object.keys(PROVIDER_MODELS).sort());
    for (const provider of PROVIDERS) {
      expect(PROVIDER_MODELS[provider].length).toBeGreaterThan(0);
      expect(new Set(PROVIDER_MODELS[provider]).size).toBe(PROVIDER_MODELS[provider].length);
    }
  });
});

describe("capability rules", () => {
  it("match the more specific id first", () => {
    expect(thinkingStyle("claude-opus-5-5")).toBe("always-on");
    expect(thinkingStyle("claude-opus-5")).toBe("adaptive");
    expect(webFetchToolType("claude-opus-4-6")).toBe("web_fetch_20260318");
    expect(webFetchToolType("claude-opus-4-5")).toBe("web_fetch_20250910");
  });

  it("answer the same for any letter case", () => {
    expect(supportsReasoning("anthropic", "CLAUDE-OPUS-5-5")).toBe(true);
    expect(supportsWebFetch("anthropic", "CLAUDE-HAIKU-4-5")).toBe(true);
    expect(supportsVision("anthropic", "Claude-Sonnet-5-5")).toBe(true);
    expect(supportsVision("openai", "GPT-4O")).toBe(true);
  });

  it("never offer web fetch on OpenAI", () => {
    for (const model of PROVIDER_MODELS.openai) expect(supportsWebFetch("openai", model)).toBe(false);
  });

  it("have a style for every thinking hint and a tool for every web fetch hint", () => {
    for (const [hint] of THINKING_STYLES) expect(thinkingStyle(hint)).toBeDefined();
    for (const [hint] of WEB_FETCH_TOOLS) expect(webFetchToolType(hint)).toBeDefined();
  });

  it("do not claim a capability for an unknown model", () => {
    expect(supportsReasoning("anthropic", "claude-2.1")).toBe(false);
    expect(supportsVision("anthropic", "claude-2.1")).toBe(false);
    expect(supportsVision("openai", "gpt-3.5-turbo")).toBe(false);
    expect(supportsReasoning("openai", "gpt-4o")).toBe(false);
  });
});
