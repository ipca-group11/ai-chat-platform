import { describe, expect, it } from "vitest";
import { supportsAttachmentKind } from "./model-capabilities";

describe("supportsAttachmentKind (AC-70, AC-71)", () => {
  it("AC-69: text and pdf are always supported (extracted as text for any provider/model)", () => {
    expect(supportsAttachmentKind("anthropic", "claude-3-5-haiku-latest", "text")).toBe(true);
    expect(supportsAttachmentKind("anthropic", "claude-3-5-haiku-latest", "pdf")).toBe(true);
  });

  it("AC-70: image attachments are supported for known vision-capable models", () => {
    expect(supportsAttachmentKind("openai", "gpt-4o", "image")).toBe(true);
    expect(supportsAttachmentKind("anthropic", "claude-3-5-sonnet-latest", "image")).toBe(true);
  });

  it("AC-71: image attachments are rejected for models without known vision support", () => {
    expect(supportsAttachmentKind("anthropic", "claude-2.1", "image")).toBe(false);
  });

  it("ignores the letter case of the model id, like the server does", () => {
    expect(supportsAttachmentKind("openai", "GPT-4O", "image")).toBe(true);
    expect(supportsAttachmentKind("anthropic", "Claude-Sonnet-5-5", "image")).toBe(true);
  });
});
