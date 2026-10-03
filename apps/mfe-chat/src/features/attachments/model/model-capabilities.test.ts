import { describe, expect, it } from "vitest";
import { supportsAttachmentKind } from "./model-capabilities";

describe("supportsAttachmentKind (AC-70, AC-71)", () => {
  it("AC-69: text and pdf are always supported (extracted as text for any provider/model)", () => {
    expect(supportsAttachmentKind("ollama", "llama3.2:1b", "text")).toBe(true);
    expect(supportsAttachmentKind("ollama", "llama3.2:1b", "pdf")).toBe(true);
  });

  it("AC-70: image attachments are supported for known vision-capable models", () => {
    expect(supportsAttachmentKind("openai", "gpt-4o", "image")).toBe(true);
    expect(supportsAttachmentKind("anthropic", "claude-3-5-sonnet-latest", "image")).toBe(true);
  });

  it("AC-71: image attachments are rejected for models without known vision support", () => {
    expect(supportsAttachmentKind("ollama", "llama3.2:1b", "image")).toBe(false);
  });
});
