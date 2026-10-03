import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "../features/llm-adapters/anthropic.provider.js";
import { OpenAiProvider } from "../features/llm-adapters/openai.provider.js";
import { ProviderError } from "../features/llm-adapters/types.js";

describe("no-network guard (setup-no-network.ts)", () => {
  it("throws when a test calls the global fetch", () => {
    expect(() => fetch("https://api.openai.com/v1/chat/completions")).toThrow("Network access is disabled in tests");
  });

  it.each([
    ["anthropic", new AnthropicProvider(), "claude-3-5-sonnet"],
    ["openai", new OpenAiProvider(), "gpt-4o"],
  ] as const)("fails an %s adapter built without fetchImpl instead of reaching the network", async (_id, provider, model) => {
    const drain = async () => {
      for await (const _chunk of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model, apiKey: "k" })) {
        // drain
      }
    };
    // The adapter wraps the failure as a retryable ProviderError; the guard's error is the cause.
    const error: unknown = await drain().then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).cause).toEqual(new Error("Network access is disabled in tests"));
  });
});
