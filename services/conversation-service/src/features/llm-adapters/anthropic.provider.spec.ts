import { describe, expect, it, vi } from "vitest";
import { mockJsonErrorResponse, mockStreamResponse } from "../../test-utils/mock-stream.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { ProviderError } from "./types.js";
import type { WebFetchDomainPolicy } from "./web-fetch-domains.js";

describe("AnthropicProvider", () => {
  it("AC-63: implements the common LlmProvider interface", () => {
    const provider = new AnthropicProvider();
    expect(provider.id).toBe("anthropic");
  });

  it("AICHAT-212: stop reasons that cut the answer off mark it as truncated", async () => {
    const run = async (stopReason: string) => {
      const fetchImpl = vi.fn().mockResolvedValue(
        mockStreamResponse([
          `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "1 2" } })}\n\n`,
          `data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: stopReason } })}\n\n`,
          `data: ${JSON.stringify({ type: "message_stop" })}\n\n`,
        ]),
      );
      const chunks: unknown[] = [];
      for await (const chunk of new AnthropicProvider({ fetchImpl }).sendMessage({
        messages: [{ role: "user", content: "count" }],
        model: "claude-haiku-4-5",
        apiKey: "anthropic-test",
      })) {
        chunks.push(chunk);
      }
      return chunks;
    };

    expect(await run("max_tokens")).toEqual(["1 2", { type: "truncated" }]);
    expect(await run("model_context_window_exceeded")).toEqual(["1 2", { type: "truncated" }]);
    expect(await run("end_turn")).toEqual(["1 2"]);
  });

  it("AC-52: streams tokens parsed from content_block_delta SSE events", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockStreamResponse([
        `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Hel" } })}\n\n`,
        `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "lo" } })}\n\n`,
        `data: ${JSON.stringify({ type: "message_stop" })}\n\n`,
      ]),
    );
    const provider = new AnthropicProvider({ fetchImpl });

    const tokens: string[] = [];
    for await (const token of provider.sendMessage({
      messages: [
        { role: "system", content: "be nice" },
        { role: "user", content: "hi" },
      ],
      model: "claude-3-5-sonnet",
      apiKey: "anthropic-test",
    })) {
      tokens.push(token);
    }

    expect(tokens.join("")).toBe("Hello");
    const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = requestInit.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("anthropic-test");
    const body = JSON.parse(requestInit.body as string) as { system?: string; messages: unknown[] };
    expect(body.system).toBe("be nice");
    expect(body.messages).toHaveLength(1);
  });

  it("AC-72: rejects without an API key without crashing the process", async () => {
    const provider = new AnthropicProvider();
    const drain = async () => {
      for await (const _t of provider.sendMessage({ messages: [], model: "claude-3-5-sonnet" })) {
        // drain
      }
    };
    await expect(drain()).rejects.toBeInstanceOf(ProviderError);
  });

  it("AC-70: reports vision support for the claude-3 family", () => {
    const provider = new AnthropicProvider();
    expect(provider.supportsVision("claude-3-5-sonnet")).toBe(true);
  });

  it("AC-70: sends image attachments as multimodal content blocks", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockStreamResponse([`data: ${JSON.stringify({ type: "message_stop" })}\n\n`]),
    );
    const provider = new AnthropicProvider({ fetchImpl });

    for await (const _t of provider.sendMessage({
      messages: [{ role: "user", content: "describe", attachments: [{ kind: "image", content: "YmFzZTY0", mimeType: "image/png", filename: "a.png" }] }],
      model: "claude-3-5-sonnet",
      apiKey: "key",
    })) {
      // drain
    }

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { messages: Array<{ content: unknown }> };
    expect(body.messages[0]?.content).toEqual([
      { type: "text", text: "describe" },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "YmFzZTY0" } },
    ]);
  });

  it("AC-72: a network failure is surfaced as a retryable ProviderError", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = new AnthropicProvider({ fetchImpl });

    try {
      for await (const _t of provider.sendMessage({ messages: [], model: "claude-3-5-sonnet", apiKey: "key" })) {
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
    const provider = new AnthropicProvider({ fetchImpl });

    await expect(async () => {
      for await (const _t of provider.sendMessage({ messages: [], model: "claude-3-5-sonnet", apiKey: "key" })) {
        // drain
      }
    }).rejects.toBe(abortError);
  });

  it("AC-72: surfaces a rate-limit response as a retryable ProviderError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockJsonErrorResponse(429, { error: { message: "slow down" } }));
    const provider = new AnthropicProvider({ fetchImpl });

    try {
      for await (const _t of provider.sendMessage({ messages: [], model: "claude-3-5-sonnet", apiKey: "key" })) {
        // drain
      }
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).retryable).toBe(true);
      expect((err as ProviderError).message).toBe("slow down");
    }
  });

  it("falls back to a generic message when the error response body isn't JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("not json"); } });
    const provider = new AnthropicProvider({ fetchImpl });

    try {
      for await (const _t of provider.sendMessage({ messages: [], model: "claude-3-5-sonnet", apiKey: "key" })) {
        // drain
      }
      expect.unreachable();
    } catch (err) {
      expect((err as ProviderError).message).toContain("500");
    }
  });

  it("AC-72: a `type: error` SSE event is surfaced as a retryable ProviderError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockStreamResponse([`data: ${JSON.stringify({ type: "error", error: { message: "overloaded" } })}\n\n`]),
    );
    const provider = new AnthropicProvider({ fetchImpl });

    try {
      for await (const _t of provider.sendMessage({ messages: [], model: "claude-3-5-sonnet", apiKey: "key" })) {
        // drain
      }
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).message).toBe("overloaded");
    }
  });

  describe("reasoning", () => {
    async function requestBody(model: string, reasoning: boolean): Promise<Record<string, unknown>> {
      const fetchImpl = vi.fn().mockResolvedValue(mockStreamResponse([`data: ${JSON.stringify({ type: "message_stop" })}\n\n`]));
      const provider = new AnthropicProvider({ fetchImpl });
      for await (const _t of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model, apiKey: "k", reasoning })) {
        // drain
      }
      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      return JSON.parse(init.body as string) as Record<string, unknown>;
    }

    it("reports reasoning support per model generation", () => {
      const provider = new AnthropicProvider();
      expect(provider.supportsReasoning("claude-opus-5-5")).toBe(true);
      expect(provider.supportsReasoning("claude-haiku-4-5")).toBe(true);
      expect(provider.supportsReasoning("claude-3-5-sonnet-latest")).toBe(false);
    });

    it("tunes effort on models whose thinking can't be turned off", async () => {
      expect((await requestBody("claude-opus-5-5", true)).output_config).toEqual({ effort: "high" });
      const off = await requestBody("claude-opus-5-5", false);
      expect(off.output_config).toEqual({ effort: "low" });
      expect(off.thinking).toBeUndefined();
    });

    it("uses between_tools to turn thinking off on Sonnet 5.5", async () => {
      expect((await requestBody("claude-sonnet-5-5", true)).thinking).toEqual({ type: "adaptive", display: "summarized" });
      expect((await requestBody("claude-sonnet-5-5", false)).thinking).toEqual({ type: "between_tools" });
    });

    it("switches adaptive thinking on and off", async () => {
      expect((await requestBody("claude-opus-5", true)).thinking).toEqual({ type: "adaptive", display: "summarized" });
      expect((await requestBody("claude-opus-4-8", false)).thinking).toEqual({ type: "disabled" });
    });

    it("sends a thinking budget below max_tokens on older models", async () => {
      const on = await requestBody("claude-haiku-4-5", true);
      const thinking = on.thinking as { type: string; budget_tokens: number };
      expect(thinking.type).toBe("enabled");
      expect(thinking.budget_tokens).toBeLessThan(on.max_tokens as number);
      expect((await requestBody("claude-haiku-4-5", false)).thinking).toBeUndefined();
    });

    it("asks for summarized thinking where the default is empty, except on 4.6 models", async () => {
      expect((await requestBody("claude-opus-5-5", true)).thinking).toEqual({ type: "adaptive", display: "summarized" });
      expect((await requestBody("claude-sonnet-4-6", true)).thinking).toEqual({ type: "adaptive" });
    });

    it("streams thinking_delta events as reasoning chunks", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        mockStreamResponse([
          `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "thinking_delta", thinking: "Let me see" } })}\n\n`,
          `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "42" } })}\n\n`,
          `data: ${JSON.stringify({ type: "message_stop" })}\n\n`,
        ]),
      );
      const provider = new AnthropicProvider({ fetchImpl });
      const chunks: unknown[] = [];
      for await (const chunk of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model: "claude-opus-5-5", apiKey: "k", reasoning: true })) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual([{ type: "reasoning", text: "Let me see" }, "42"]);
    });

    it("sends no thinking settings to models without reasoning", async () => {
      const body = await requestBody("claude-3-5-sonnet-latest", true);
      expect(body.thinking).toBeUndefined();
      expect(body.output_config).toBeUndefined();
    });
  });

  describe("web fetch", () => {
    const sse = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;

    async function run(fetchImpl: ReturnType<typeof vi.fn>, model: string, webFetch: boolean, webFetchDomains?: WebFetchDomainPolicy) {
      const provider = new AnthropicProvider({ fetchImpl, webFetchDomains });
      const chunks: unknown[] = [];
      for await (const chunk of provider.sendMessage({ messages: [{ role: "user", content: "read https://example.com" }], model, apiKey: "k", webFetch })) {
        chunks.push(chunk);
      }
      const bodies = fetchImpl.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>);
      return { chunks, bodies };
    }

    const fetchTurn = [
      sse({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
      sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Reading it." } }),
      sse({ type: "content_block_stop", index: 0 }),
      sse({ type: "content_block_start", index: 1, content_block: { type: "server_tool_use", id: "srvtoolu_1", name: "web_fetch", input: {} } }),
      sse({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"url":"https://exa' } }),
      sse({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: 'mple.com"}' } }),
      sse({ type: "content_block_stop", index: 1 }),
      sse({
        type: "content_block_start",
        index: 2,
        content_block: {
          type: "web_fetch_tool_result",
          tool_use_id: "srvtoolu_1",
          content: { type: "web_fetch_result", url: "https://example.com", content: { type: "document", title: "Example Domain" } },
        },
      }),
      sse({ type: "content_block_stop", index: 2 }),
    ];

    it("reports web fetch support per model generation", () => {
      const provider = new AnthropicProvider();
      expect(provider.supportsWebFetch("claude-opus-5-5")).toBe(true);
      expect(provider.supportsWebFetch("claude-haiku-4-5")).toBe(true);
      expect(provider.supportsWebFetch("claude-3-5-sonnet-latest")).toBe(false);
    });

    it("sends the dynamic-filtering tool to newer models and the basic one to older models", async () => {
      const done = () => mockStreamResponse([sse({ type: "message_stop" })]);
      const newer = await run(vi.fn().mockResolvedValue(done()), "claude-opus-5-5", true);
      expect(newer.bodies[0]?.tools).toEqual([
        { type: "web_fetch_20260318", name: "web_fetch", max_uses: 5, max_content_tokens: 25000 },
      ]);
      const older = await run(vi.fn().mockResolvedValue(done()), "claude-haiku-4-5", true);
      expect((older.bodies[0]?.tools as Array<{ type: string }>)[0]?.type).toBe("web_fetch_20250910");
    });

    it("sends no tools when web fetch is off or the model can't fetch", async () => {
      const done = () => mockStreamResponse([sse({ type: "message_stop" })]);
      expect((await run(vi.fn().mockResolvedValue(done()), "claude-opus-5-5", false)).bodies[0]?.tools).toBeUndefined();
      expect((await run(vi.fn().mockResolvedValue(done()), "claude-3-5-sonnet-latest", true)).bodies[0]?.tools).toBeUndefined();
    });

    it("streams fetch progress between the answer text", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        mockStreamResponse([
          ...fetchTurn,
          sse({ type: "content_block_start", index: 3, content_block: { type: "text", text: "" } }),
          sse({ type: "content_block_delta", index: 3, delta: { type: "text_delta", text: " It says hi." } }),
          sse({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
          sse({ type: "message_stop" }),
        ]),
      );
      const { chunks } = await run(fetchImpl, "claude-opus-5-5", true);
      expect(chunks).toEqual([
        "Reading it.",
        { type: "web_fetch", id: "srvtoolu_1", url: "https://example.com", status: "fetching" },
        { type: "web_fetch", id: "srvtoolu_1", url: "https://example.com", status: "done", title: "Example Domain" },
        " It says hi.",
      ]);
    });

    it("reports a failed fetch with its error code", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        mockStreamResponse([
          ...fetchTurn.slice(3, 7),
          sse({
            type: "content_block_start",
            index: 2,
            content_block: { type: "web_fetch_tool_result", tool_use_id: "srvtoolu_1", content: { type: "web_fetch_tool_result_error", error_code: "url_not_accessible" } },
          }),
          sse({ type: "message_stop" }),
        ]),
      );
      const { chunks } = await run(fetchImpl, "claude-opus-5-5", true);
      expect(chunks.at(-1)).toEqual({ type: "web_fetch", id: "srvtoolu_1", url: "https://example.com", status: "error", errorCode: "url_not_accessible" });
    });

    it("resumes a paused turn by sending the reply so far back", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          mockStreamResponse([...fetchTurn, sse({ type: "message_delta", delta: { stop_reason: "pause_turn" } }), sse({ type: "message_stop" })]),
        )
        .mockResolvedValueOnce(
          mockStreamResponse([
            sse({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
            sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: " Done." } }),
            sse({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
            sse({ type: "message_stop" }),
          ]),
        );
      const { chunks, bodies } = await run(fetchImpl, "claude-opus-5-5", true);

      expect(chunks.at(-1)).toBe(" Done.");
      expect(bodies).toHaveLength(2);
      const messages = bodies[1]?.messages as Array<{ role: string; content: unknown }>;
      expect(messages.at(-1)).toEqual({
        role: "assistant",
        content: [
          { type: "text", text: "Reading it." },
          { type: "server_tool_use", id: "srvtoolu_1", name: "web_fetch", input: { url: "https://example.com" } },
          {
            type: "web_fetch_tool_result",
            tool_use_id: "srvtoolu_1",
            content: { type: "web_fetch_result", url: "https://example.com", content: { type: "document", title: "Example Domain" } },
          },
        ],
      });
    });

    it("sends the allowed or blocked domains of the deployment with the tool (AICHAT-242)", async () => {
      const done = () => mockStreamResponse([sse({ type: "message_stop" })]);
      const allowed = await run(vi.fn().mockResolvedValue(done()), "claude-opus-5-5", true, { allowed: ["example.com", "docs.python.org"] });
      expect((allowed.bodies[0]?.tools as Array<Record<string, unknown>>)[0]).toMatchObject({
        name: "web_fetch",
        allowed_domains: ["example.com", "docs.python.org"],
      });
      const blocked = await run(vi.fn().mockResolvedValue(done()), "claude-opus-5-5", true, { blocked: ["attacker.example"] });
      const tool = (blocked.bodies[0]?.tools as Array<Record<string, unknown>>)[0];
      expect(tool).toMatchObject({ blocked_domains: ["attacker.example"] });
      expect(tool).not.toHaveProperty("allowed_domains");
    });

    it("passes on a fetch the API refused for its domain (AICHAT-242)", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        mockStreamResponse([
          ...fetchTurn.slice(0, 7),
          sse({
            type: "content_block_start",
            index: 2,
            content_block: {
              type: "web_fetch_tool_result",
              tool_use_id: "srvtoolu_1",
              content: { type: "web_fetch_tool_error", error_code: "url_not_allowed" },
            },
          }),
          sse({ type: "content_block_stop", index: 2 }),
          sse({ type: "message_stop" }),
        ]),
      );
      const { chunks } = await run(fetchImpl, "claude-opus-5-5", true, { allowed: ["python.org"] });
      expect(chunks.at(-1)).toEqual({ type: "web_fetch", id: "srvtoolu_1", url: "https://example.com", status: "error", errorCode: "url_not_allowed" });
    });

    it("stops the answer when a page outside the allowed domains comes back anyway (AICHAT-242)", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        mockStreamResponse([
          ...fetchTurn,
          sse({ type: "content_block_start", index: 3, content_block: { type: "text", text: "" } }),
          sse({ type: "content_block_delta", index: 3, delta: { type: "text_delta", text: " It says hi." } }),
          sse({ type: "message_stop" }),
        ]),
      );
      const chunks: unknown[] = [];
      const provider = new AnthropicProvider({ fetchImpl, webFetchDomains: { allowed: ["python.org"] } });
      const drain = async () => {
        for await (const chunk of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model: "claude-opus-5-5", apiKey: "k", webFetch: true })) {
          chunks.push(chunk);
        }
      };
      await expect(drain()).rejects.toMatchObject({ name: "ProviderError", retryable: false });
      expect(chunks).not.toContain(" It says hi.");
      expect(chunks.at(-1)).toEqual({ type: "web_fetch", id: "srvtoolu_1", url: "https://example.com", status: "fetching" });
    });
  });
});
