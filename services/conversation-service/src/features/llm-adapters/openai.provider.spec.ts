import { describe, expect, it, vi } from "vitest";
import { mockJsonErrorResponse, mockStreamResponse } from "../../test-utils/mock-stream.js";
import { OpenAiProvider } from "./openai.provider.js";
import { ProviderError } from "./types.js";

describe("OpenAiProvider", () => {
  it("AC-63: implements the common LlmProvider interface", () => {
    const provider = new OpenAiProvider();
    expect(provider.id).toBe("openai");
  });

  it("AC-52: streams tokens parsed from SSE `data:` chunks", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockStreamResponse([
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Hel" } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: "lo" } }] })}\n\n`,
        `data: [DONE]\n\n`,
      ]),
    );
    const provider = new OpenAiProvider({ fetchImpl });

    const tokens: string[] = [];
    for await (const token of provider.sendMessage({
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-4o-mini",
      apiKey: "sk-test",
    })) {
      tokens.push(token);
    }

    expect(tokens.join("")).toBe("Hello");
    const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((requestInit.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
  });

  it("AC-72: rejects without an API key without crashing the process", async () => {
    const provider = new OpenAiProvider();
    const drain = async () => {
      for await (const _t of provider.sendMessage({ messages: [], model: "gpt-4o-mini" })) {
        // drain
      }
    };
    await expect(drain()).rejects.toBeInstanceOf(ProviderError);
  });

  it("AC-72: surfaces rate-limit errors as retryable", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(mockJsonErrorResponse(429, { error: { message: "Rate limit exceeded" } }));
    const provider = new OpenAiProvider({ fetchImpl });

    try {
      for await (const _t of provider.sendMessage({ messages: [], model: "gpt-4o-mini", apiKey: "sk-test" })) {
        // drain
      }
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).retryable).toBe(true);
      expect((err as ProviderError).message).toBe("Rate limit exceeded");
    }
  });

  it("AC-70: reports vision support for gpt-4o family models", () => {
    const provider = new OpenAiProvider();
    expect(provider.supportsVision("gpt-4o")).toBe(true);
    expect(provider.supportsVision("gpt-3.5-turbo")).toBe(false);
  });

  it("AC-70: sends image attachments as multimodal content parts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockStreamResponse([`data: [DONE]\n\n`]));
    const provider = new OpenAiProvider({ fetchImpl });

    for await (const _t of provider.sendMessage({
      messages: [{ role: "user", content: "describe", attachments: [{ kind: "image", content: "YmFzZTY0", mimeType: "image/png", filename: "a.png" }] }],
      model: "gpt-4o",
      apiKey: "sk-test",
    })) {
      // drain
    }

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { messages: Array<{ content: unknown }> };
    expect(body.messages[0]?.content).toEqual([
      { type: "text", text: "describe" },
      { type: "image_url", image_url: { url: "data:image/png;base64,YmFzZTY0" } },
    ]);
  });

  it("AC-72: a network failure is surfaced as a retryable ProviderError", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = new OpenAiProvider({ fetchImpl });

    try {
      for await (const _t of provider.sendMessage({ messages: [], model: "gpt-4o-mini", apiKey: "sk-test" })) {
        // drain
      }
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).retryable).toBe(true);
    }
  });

  it("propagates an AbortError from fetch without wrapping it", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const fetchImpl = vi.fn().mockRejectedValue(abortError);
    const provider = new OpenAiProvider({ fetchImpl });

    await expect(async () => {
      for await (const _t of provider.sendMessage({ messages: [], model: "gpt-4o-mini", apiKey: "sk-test" })) {
        // drain
      }
    }).rejects.toBe(abortError);
  });

  describe("reasoning", () => {
    async function requestBody(model: string, reasoning: boolean): Promise<Record<string, unknown>> {
      const fetchImpl = vi.fn().mockResolvedValue(mockStreamResponse(["data: [DONE]\n\n"]));
      const provider = new OpenAiProvider({ fetchImpl });
      for await (const _t of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model, apiKey: "k", reasoning })) {
        // drain
      }
      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      return JSON.parse(init.body as string) as Record<string, unknown>;
    }

    it("reports reasoning support for o-series and GPT-5 models only", () => {
      const provider = new OpenAiProvider();
      expect(provider.supportsReasoning("o4-mini")).toBe(true);
      expect(provider.supportsReasoning("gpt-5-mini")).toBe(true);
      expect(provider.supportsReasoning("gpt-4o")).toBe(false);
    });

    it("asks for high effort when on and the lowest effort the model accepts when off", async () => {
      expect((await requestBody("o4-mini", true)).reasoning_effort).toBe("high");
      expect((await requestBody("o4-mini", false)).reasoning_effort).toBe("low");
      expect((await requestBody("gpt-5-mini", false)).reasoning_effort).toBe("minimal");
      expect((await requestBody("gpt-5.1", false)).reasoning_effort).toBe("none");
    });

    it("sends no reasoning_effort to models without reasoning", async () => {
      expect((await requestBody("gpt-4o", true)).reasoning_effort).toBeUndefined();
    });
  });
});
