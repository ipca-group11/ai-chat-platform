import { describe, expect, it, vi } from "vitest";
import { mockErroringStreamResponse, mockStreamResponse } from "../../test-utils/mock-stream.js";
import { OllamaProvider } from "./ollama.provider.js";
import { ProviderError } from "./types.js";

describe("OllamaProvider", () => {
  it("AC-63: implements the common LlmProvider interface", () => {
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434" });
    expect(provider.id).toBe("ollama");
    expect(typeof provider.sendMessage).toBe("function");
    expect(typeof provider.supportsVision).toBe("function");
  });

  it("AC-52: streams tokens parsed from NDJSON chunks", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockStreamResponse([
        `${JSON.stringify({ message: { content: "Hel" }, done: false })}\n`,
        `${JSON.stringify({ message: { content: "lo" }, done: false })}\n`,
        `${JSON.stringify({ message: { content: "" }, done: true })}\n`,
      ]),
    );
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });

    const tokens: string[] = [];
    for await (const token of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model: "llama3.2:1b" })) {
      tokens.push(token);
    }

    expect(tokens.join("")).toBe("Hello");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("AC-72: throws a retryable ProviderError on 5xx responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockStreamResponse([], { ok: false, status: 503 }));
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });

    const drain = async () => {
      for await (const _t of provider.sendMessage({ messages: [], model: "llama3.2:1b" })) {
        // drain
      }
    };

    await expect(drain()).rejects.toBeInstanceOf(ProviderError);
    try {
      await drain();
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).retryable).toBe(true);
    }
  });

  it("AC-72: includes Ollama's own error text (e.g. a missing model) in the ProviderError", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(mockStreamResponse(['{"error":"model \'llama3.2:1b\' not found"}'], { ok: false, status: 404 }));
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });

    const drain = async () => {
      for await (const _t of provider.sendMessage({ messages: [], model: "llama3.2:1b" })) {
        // drain
      }
    };

    await expect(drain()).rejects.toMatchObject({ message: "Ollama: model 'llama3.2:1b' not found", retryable: false });
  });

  it("AC-71: does not report vision support for a non-vision model", () => {
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434" });
    expect(provider.supportsVision("llama3.2:1b")).toBe(false);
    expect(provider.supportsVision("llava:13b")).toBe(true);
  });

  it("AC-70: includes image attachment bytes in the request body for vision models", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockStreamResponse([`${JSON.stringify({ message: { content: "ok" }, done: true })}\n`]),
    );
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });

    const drain = async () => {
      for await (const _t of provider.sendMessage({
        messages: [{ role: "user", content: "describe", attachments: [{ kind: "image", content: "YmFzZTY0", mimeType: "image/png", filename: "a.png" }] }],
        model: "llava:13b",
      })) {
        // drain
      }
    };
    await drain();

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { messages: Array<{ images?: string[] }> };
    expect(body.messages[0]?.images).toEqual(["YmFzZTY0"]);
  });

  it("AC-72: a network failure is surfaced as a retryable ProviderError", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });

    try {
      for await (const _t of provider.sendMessage({ messages: [], model: "llama3.2:1b" })) {
        // drain
      }
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).retryable).toBe(true);
      expect((err as ProviderError).message).toContain("Failed to reach Ollama");
    }
  });

  it("propagates an AbortError from fetch without wrapping it", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const fetchImpl = vi.fn().mockRejectedValue(abortError);
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });

    await expect(async () => {
      for await (const _t of provider.sendMessage({ messages: [], model: "llama3.2:1b" })) {
        // drain
      }
    }).rejects.toBe(abortError);
  });

  it("AC-54: an AbortError raised while reading the stream body is rethrown as-is", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const fetchImpl = vi.fn().mockResolvedValue(mockErroringStreamResponse(abortError));
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });

    await expect(async () => {
      for await (const _t of provider.sendMessage({ messages: [], model: "llama3.2:1b" })) {
        // drain
      }
    }).rejects.toBe(abortError);
  });

  it("AC-72: a non-abort failure while reading the stream body is wrapped in a ProviderError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockErroringStreamResponse(new Error("stream broke")));
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });

    try {
      for await (const _t of provider.sendMessage({ messages: [], model: "llama3.2:1b" })) {
        // drain
      }
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
    }
  });

  it("AC-72: an `error` field mid-stream is surfaced as a retryable ProviderError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockStreamResponse([`${JSON.stringify({ error: "model not found" })}\n`]),
    );
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });

    try {
      for await (const _t of provider.sendMessage({ messages: [], model: "llama3.2:1b" })) {
        // drain
      }
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).toBe("model not found");
    }
  });

  describe("reasoning", () => {
    async function requestBody(model: string, reasoning: boolean): Promise<Record<string, unknown>> {
      const fetchImpl = vi.fn().mockResolvedValue(mockStreamResponse([`${JSON.stringify({ done: true })}\n`]));
      const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });
      for await (const _t of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model, reasoning })) {
        // drain
      }
      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      return JSON.parse(init.body as string) as Record<string, unknown>;
    }

    it("reports reasoning support for thinking models only", () => {
      const provider = new OllamaProvider({ baseUrl: "http://localhost:11434" });
      expect(provider.supportsReasoning("qwen3:4b")).toBe(true);
      expect(provider.supportsReasoning("llama3.2:1b")).toBe(false);
    });

    it("sends think on and off to thinking models", async () => {
      expect((await requestBody("qwen3:4b", true)).think).toBe(true);
      expect((await requestBody("deepseek-r1:8b", false)).think).toBe(false);
    });

    it("uses a thinking level for gpt-oss, which can't turn thinking off", async () => {
      expect((await requestBody("gpt-oss:20b", true)).think).toBe("high");
      expect((await requestBody("gpt-oss:20b", false)).think).toBe("low");
    });

    it("streams message.thinking as reasoning chunks", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        mockStreamResponse([
          `${JSON.stringify({ message: { thinking: "Hmm" } })}\n`,
          `${JSON.stringify({ message: { content: "Hi" }, done: true })}\n`,
        ]),
      );
      const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl });
      const chunks: unknown[] = [];
      for await (const chunk of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model: "qwen3:4b", reasoning: true })) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual([{ type: "reasoning", text: "Hmm" }, "Hi"]);
    });

    it("never sends think to other models, which would reject it", async () => {
      expect((await requestBody("llama3.2:1b", true)).think).toBeUndefined();
    });
  });
});
