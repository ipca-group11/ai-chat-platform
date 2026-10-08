import { describe, expect, it } from "vitest";
import { PROVIDER_LABELS, providerLabel } from "./providerMeta";

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
