import { describe, expect, it } from "vitest";
import { PROVIDERS, PROVIDER_MODELS, type Provider } from "@app/shared-types/model-capabilities";
import { supportsAttachmentKind } from "@parity/mfe-chat/features/attachments/model/model-capabilities";
import { supportsReasoning, supportsWebFetch } from "@parity/mfe-chat/shared/model-capabilities";
import * as chatTypes from "@parity/mfe-chat/shared/types";
import { AnthropicProvider } from "@parity/conversation-service/features/llm-adapters/anthropic.provider";
import { OpenAiProvider } from "@parity/conversation-service/features/llm-adapters/openai.provider";

// Capability parity between the chat UI (apps/mfe-chat) and the server
// (services/conversation-service) for every selectable model (AICHAT-133). Both read their
// rules from packages/shared-types; this test fails when either side stops agreeing with the
// other, for example when one of them gets its own copy of a table again.

interface ServerCapabilities {
  supportsReasoning(model: string): boolean;
  supportsWebFetch(model: string): boolean;
  supportsVision(model: string): boolean;
}

const backend: Record<Provider, ServerCapabilities> = { anthropic: new AnthropicProvider(), openai: new OpenAiProvider() };

/** Ids outside the catalogue, in other letter cases: the two sides must still agree. */
const EXTRA_MODELS: Record<Provider, string[]> = {
  anthropic: [
    "CLAUDE-OPUS-5-5",
    "Claude-Sonnet-5-5",
    "claude-opus-4-6",
    "claude-sonnet-4-5",
    "claude-3-7-sonnet-latest",
    "claude-2.1",
    "claude-instant-1",
    "",
  ],
  openai: ["GPT-4O", "gpt-4-vision-preview", "gpt-5", "o1", "o3-mini", "gpt-3.5-turbo", "gpt-4", ""],
};

const cases = PROVIDERS.flatMap((provider) =>
  [...PROVIDER_MODELS[provider], ...EXTRA_MODELS[provider]].map((model): [Provider, string] => [provider, model]),
);

describe("model catalogue", () => {
  it("is the shared one in the chat UI, not a copy", () => {
    expect(chatTypes.PROVIDER_MODELS).toBe(PROVIDER_MODELS);
    expect(chatTypes.PROVIDERS).toBe(PROVIDERS);
  });

  it("has a server adapter for every provider", () => {
    expect(Object.keys(backend).sort()).toEqual([...PROVIDERS].sort());
  });

  it("checks every selectable model", () => {
    const selectable = PROVIDERS.reduce((sum, p) => sum + PROVIDER_MODELS[p].length, 0);
    expect(selectable).toBeGreaterThanOrEqual(10);
    expect(cases.length).toBeGreaterThan(selectable);
  });
});

describe("chat UI and server agree on", () => {
  it.each(cases)("%s / %s: reasoning", (provider, model) => {
    expect(supportsReasoning(provider, model)).toBe(backend[provider].supportsReasoning(model));
  });

  it.each(cases)("%s / %s: web fetch", (provider, model) => {
    expect(supportsWebFetch(provider, model)).toBe(backend[provider].supportsWebFetch(model));
  });

  it.each(cases)("%s / %s: vision (image attachments)", (provider, model) => {
    expect(supportsAttachmentKind(provider, model, "image")).toBe(backend[provider].supportsVision(model));
  });
});
