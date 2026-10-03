import { describe, expect, it } from "vitest";
import { PROVIDER_LABELS, PROVIDER_NO_KEY_DESCRIPTIONS, providerLabel } from "./providerMeta";

describe("providerLabel", () => {
  it("AC-76: labels openai and anthropic for display", () => {
    expect(providerLabel("openai")).toBe("OpenAI");
    expect(providerLabel("anthropic")).toBe("Anthropic");
  });

  it("AC-77: labels ollama for display", () => {
    expect(providerLabel("ollama")).toBe("Ollama");
  });

  it("has a label for every provider in PROVIDER_LABELS", () => {
    expect(Object.keys(PROVIDER_LABELS).sort()).toEqual(["anthropic", "ollama", "openai"]);
  });
});

describe("PROVIDER_NO_KEY_DESCRIPTIONS", () => {
  it("AC-77: explains why ollama has no key input", () => {
    expect(PROVIDER_NO_KEY_DESCRIPTIONS.ollama).toMatch(/no api key is required/i);
  });

  it("AC-76: does not describe openai/anthropic as keyless", () => {
    expect(PROVIDER_NO_KEY_DESCRIPTIONS.openai).toBeUndefined();
    expect(PROVIDER_NO_KEY_DESCRIPTIONS.anthropic).toBeUndefined();
  });
});
