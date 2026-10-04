import { describe, expect, it } from "vitest";
import { supportsAttachmentKind } from "../features/attachments/model/model-capabilities";
import { supportsReasoning, supportsWebFetch } from "./model-capabilities";
import { PROVIDERS, PROVIDER_MODELS, type Provider } from "./types";

interface Capabilities {
  reasoning: boolean;
  webFetch: boolean;
  vision: boolean;
}

/**
 * What each selectable model is expected to do. Adding a model to PROVIDER_MODELS without a row
 * here fails "has an expectation for every model", so a new model cannot slip into the UI with
 * an unchecked (and probably wrong) capability.
 */
const EXPECTED: Record<Provider, Record<string, Capabilities>> = {
  ollama: {
    "llama3.2:1b": { reasoning: false, webFetch: false, vision: false },
    "llama3.2:3b": { reasoning: false, webFetch: false, vision: false },
    "llama3.1:8b": { reasoning: false, webFetch: false, vision: false },
    "qwen3:4b": { reasoning: true, webFetch: false, vision: false },
    "qwen3:8b": { reasoning: true, webFetch: false, vision: false },
    "deepseek-r1:8b": { reasoning: true, webFetch: false, vision: false },
  },
  openai: {
    "gpt-4o": { reasoning: false, webFetch: false, vision: true },
    "gpt-4o-mini": { reasoning: false, webFetch: false, vision: true },
    "gpt-4.1": { reasoning: false, webFetch: false, vision: true },
    "gpt-5-mini": { reasoning: true, webFetch: false, vision: true },
    "o4-mini": { reasoning: true, webFetch: false, vision: true },
  },
  anthropic: {
    "claude-opus-5-5": { reasoning: true, webFetch: true, vision: true },
    "claude-sonnet-5-5": { reasoning: true, webFetch: true, vision: true },
    "claude-haiku-4-5": { reasoning: true, webFetch: true, vision: true },
    "claude-3-5-sonnet-latest": { reasoning: false, webFetch: false, vision: true },
    "claude-3-5-haiku-latest": { reasoning: false, webFetch: false, vision: true },
  },
};

const ALL_MODELS: [Provider, string][] = PROVIDERS.flatMap((provider) =>
  PROVIDER_MODELS[provider].map((model): [Provider, string] => [provider, model])
);

describe("capability expectations", () => {
  it.each(PROVIDERS)("has an expectation for every %s model, and for no model that is gone", (provider) => {
    expect(Object.keys(EXPECTED[provider]).sort()).toEqual([...PROVIDER_MODELS[provider]].sort());
  });

  it("covers a non-trivial number of models", () => {
    expect(ALL_MODELS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("PROVIDER_MODELS capability tables", () => {
  it.each(ALL_MODELS)("%s / %s: reasoning matches the expectation", (provider, model) => {
    expect(supportsReasoning(provider, model)).toBe(EXPECTED[provider][model]!.reasoning);
  });

  it.each(ALL_MODELS)("%s / %s: web fetch matches the expectation", (provider, model) => {
    expect(supportsWebFetch(provider, model)).toBe(EXPECTED[provider][model]!.webFetch);
  });

  it.each(ALL_MODELS)("%s / %s: image (vision) matches the expectation", (provider, model) => {
    expect(supportsAttachmentKind(provider, model, "image")).toBe(EXPECTED[provider][model]!.vision);
  });

  it.each(ALL_MODELS)("%s / %s: text attachments are supported", (provider, model) => {
    expect(supportsAttachmentKind(provider, model, "text")).toBe(true);
  });

  it.each(ALL_MODELS)("%s / %s: pdf attachments are supported", (provider, model) => {
    expect(supportsAttachmentKind(provider, model, "pdf")).toBe(true);
  });
});

describe("models outside the tables", () => {
  it("do not claim any capability that needs an allow-list", () => {
    expect(supportsReasoning("anthropic", "claude-unknown-9")).toBe(false);
    expect(supportsReasoning("openai", "unknown-model")).toBe(false);
    expect(supportsWebFetch("anthropic", "claude-unknown-9")).toBe(false);
    expect(supportsWebFetch("openai", "unknown-model")).toBe(false);
    expect(supportsAttachmentKind("openai", "unknown-model", "image")).toBe(false);
    expect(supportsAttachmentKind("anthropic", "claude-unknown-9", "image")).toBe(false);
  });

  it("still accept text and pdf, which every model can read as text", () => {
    expect(supportsAttachmentKind("openai", "unknown-model", "text")).toBe(true);
    expect(supportsAttachmentKind("anthropic", "claude-unknown-9", "pdf")).toBe(true);
  });
});
