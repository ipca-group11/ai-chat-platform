import { describe, expect, it } from "vitest";
import { PROVIDER_LABELS, PROVIDER_NO_KEY_DESCRIPTIONS, providerLabel } from "./providerMeta";

describe("providerLabel", () => {
  it("AC-76: labels openai and anthropic for display", () => {
    expect(providerLabel("openai")).toBe("OpenAI");
    expect(providerLabel("anthropic")).toBe("Anthropic");
  });

  it("has a label for every provider in PROVIDER_LABELS", () => {
    expect(Object.keys(PROVIDER_LABELS).sort()).toEqual(["anthropic", "openai"]);
  });
});

describe("PROVIDER_NO_KEY_DESCRIPTIONS", () => {
  it("AC-76: does not describe openai/anthropic as keyless", () => {
    expect(PROVIDER_NO_KEY_DESCRIPTIONS.openai).toBeUndefined();
    expect(PROVIDER_NO_KEY_DESCRIPTIONS.anthropic).toBeUndefined();
  });
});
