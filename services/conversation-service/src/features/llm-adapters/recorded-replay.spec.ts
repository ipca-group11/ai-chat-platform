import { describe, expect, it } from "vitest";
import { replayFetch, replayHttpError, replaySse } from "../../test-utils/replay.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { OpenAiProvider } from "./openai.provider.js";
import { ProviderError, type LlmProvider, type LlmStreamChunk, type SendMessageContext } from "./types.js";

/** Replays recorded or documented provider responses (fixtures/llm) through the real
 * adapters, cut into uneven byte chunks, and asserts the exact chunk sequence. */

const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const context = (model: string, extra: Partial<SendMessageContext> = {}): SendMessageContext => ({
  messages: [{ role: "user", content: "hi" }],
  model,
  apiKey: "test-key",
  ...extra,
});

async function collect(provider: LlmProvider, ctx: SendMessageContext): Promise<LlmStreamChunk[]> {
  const chunks: LlmStreamChunk[] = [];
  for await (const chunk of provider.sendMessage(ctx)) chunks.push(chunk);
  return chunks;
}

async function failure(promise: Promise<unknown>): Promise<ProviderError> {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ProviderError);
  return error as ProviderError;
}

const anthropic = (...responses: Response[]) => {
  const replay = replayFetch(...responses);
  return { provider: new AnthropicProvider({ fetchImpl: replay.fetch }), requests: replay.requests };
};
const openai = (...responses: Response[]) => {
  const replay = replayFetch(...responses);
  return { provider: new OpenAiProvider({ fetchImpl: replay.fetch }), requests: replay.requests };
};

/** Chunk layouts every stream fixture is replayed with: the default uneven cycle, one byte at a time, one piece. */
const LAYOUTS = [
  ["uneven (1, 7, 64, 3)", { chunkSizes: [1, 7, 64, 3] }],
  ["one byte at a time", { chunkSizes: [1] }],
  ["whole body", { chunkSizes: [1_000_000] }],
] as const;

describe.each(LAYOUTS)("recorded replay, %s", (_name, layout) => {
  describe("Anthropic", () => {
    it("text.sse (recorded): streams the text deltas", async () => {
      const { provider } = anthropic(replaySse("anthropic", "text", layout));
      expect(await collect(provider, context(ANTHROPIC_MODEL))).toEqual(["O", "u", "ça", " at", "enção", "!"]);
    });

    it("text-ping.sse: ignores ping and keeps multi-byte text intact", async () => {
      const { provider } = anthropic(replaySse("anthropic", "text-ping", layout));
      expect(await collect(provider, context(ANTHROPIC_MODEL))).toEqual(["Olá", ", mundo! 😀"]);
    });

    it("thinking.sse: yields reasoning chunks, then the answer", async () => {
      const { provider } = anthropic(replaySse("anthropic", "thinking", layout));
      expect(await collect(provider, context(ANTHROPIC_MODEL, { reasoning: true }))).toEqual([
        { type: "reasoning", text: "17 times 23: " },
        { type: "reasoning", text: "17*20 = 340 and 17*3 = 51, so 391." },
        "17 × 23 = ",
        "391.",
      ]);
    });

    it("max-tokens.sse (recorded): streams the text, then marks the answer as truncated (AICHAT-212)", async () => {
      const { provider } = anthropic(replaySse("anthropic", "max-tokens", layout));
      const chunks = await collect(provider, context(ANTHROPIC_MODEL));
      expect(chunks.filter((c) => typeof c === "string").join("")).toBe("1 2 3 4 5 ");
      expect(chunks.at(-1)).toEqual({ type: "truncated" });
      expect(chunks.filter((c) => typeof c !== "string")).toHaveLength(1);
    });

    it("web-fetch-error.sse: reports fetching, then the error code, then the answer", async () => {
      const { provider } = anthropic(replaySse("anthropic", "web-fetch-error", layout));
      expect(await collect(provider, context(ANTHROPIC_MODEL, { webFetch: true }))).toEqual([
        { type: "web_fetch", id: "srvtoolu_REDACTED", url: "https://unreachable.invalid", status: "fetching" },
        { type: "web_fetch", id: "srvtoolu_REDACTED", url: "https://unreachable.invalid", status: "error", errorCode: "url_not_accessible" },
        "I could not open that page.",
      ]);
    });

    it("pause-turn-1.sse + pause-turn-2.sse: resumes the paused turn with the reply so far", async () => {
      const { provider, requests } = anthropic(
        replaySse("anthropic", "pause-turn-1", layout),
        replaySse("anthropic", "pause-turn-2", layout),
      );
      const chunks = await collect(provider, context(ANTHROPIC_MODEL, { webFetch: true }));
      expect(chunks).toEqual([
        "I will fetch the page. ",
        { type: "web_fetch", id: "srvtoolu_REDACTED", url: "https://example.com", status: "fetching" },
        { type: "web_fetch", id: "srvtoolu_REDACTED", url: "https://example.com", status: "done", title: "Example Domain" },
        "The page is titled ",
        "Example Domain.",
      ]);

      expect(requests).toHaveLength(2);
      const first = requests[0]?.body as { messages: unknown[] };
      const second = requests[1]?.body as { messages: unknown[] };
      expect(first.messages).toEqual([{ role: "user", content: "hi" }]);
      expect(second.messages).toEqual([
        { role: "user", content: "hi" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I will fetch the page. " },
            { type: "server_tool_use", id: "srvtoolu_REDACTED", name: "web_fetch", input: { url: "https://example.com" } },
            {
              type: "web_fetch_tool_result",
              tool_use_id: "srvtoolu_REDACTED",
              content: {
                type: "web_fetch_result",
                url: "https://example.com",
                retrieved_at: "1970-01-01T00:00:00Z",
                content: {
                  type: "document",
                  title: "Example Domain",
                  source: { type: "text", media_type: "text/plain", data: "This domain is for use in illustrative examples." },
                },
              },
            },
          ],
        },
      ]);
    });

    it("overloaded-midstream.sse: partial text, then a retryable ProviderError", async () => {
      const { provider } = anthropic(replaySse("anthropic", "overloaded-midstream", layout));
      const received: LlmStreamChunk[] = [];
      const error = await failure(
        (async () => {
          for await (const chunk of provider.sendMessage(context(ANTHROPIC_MODEL))) received.push(chunk);
        })(),
      );
      expect(received).toEqual(["The answer starts "]);
      expect({ message: error.message, retryable: error.retryable, statusCode: error.statusCode }).toEqual({
        message: "Overloaded",
        retryable: true,
        statusCode: undefined,
      });
    });
  });

  describe("OpenAI", () => {
    it("text.sse (recorded): streams the content deltas", async () => {
      const { provider } = openai(replaySse("openai", "text", layout));
      expect(await collect(provider, context("gpt-4o"))).toEqual(["O", "u", "ça", " at", "enção", "!"]);
    });

    it("reasoning.sse: sends reasoning_effort and streams only the content", async () => {
      const { provider, requests } = openai(replaySse("openai", "reasoning", layout));
      expect(await collect(provider, context("o4-mini", { reasoning: true }))).toEqual(["17 × 23 = ", "391."]);
      expect((requests[0]?.body as { reasoning_effort: string }).reasoning_effort).toBe("high");
    });

    it("max-tokens.sse (recorded): streams the text, then marks the answer as truncated (AICHAT-212)", async () => {
      const { provider } = openai(replaySse("openai", "max-tokens", layout));
      const chunks = await collect(provider, context("gpt-4o"));
      expect(chunks.filter((c) => typeof c === "string").join("")).toBe("1 2 3 4 5 ");
      expect(chunks.at(-1)).toEqual({ type: "truncated" });
      expect(chunks.filter((c) => typeof c !== "string")).toHaveLength(1);
    });

    it("text.sse (recorded): a finished answer is not marked as truncated", async () => {
      const { provider } = openai(replaySse("openai", "text", layout));
      expect((await collect(provider, context("gpt-4o"))).every((c) => typeof c === "string")).toBe(true);
    });

    it("error-midstream.sse: partial text, then a retryable ProviderError (AICHAT-211)", async () => {
      const { provider } = openai(replaySse("openai", "error-midstream", layout));
      const received: LlmStreamChunk[] = [];
      const error = await failure(
        (async () => {
          for await (const chunk of provider.sendMessage(context("gpt-4o"))) received.push(chunk);
        })(),
      );
      expect(received).toEqual(["The answer starts "]);
      expect({ message: error.message, retryable: error.retryable, statusCode: error.statusCode }).toEqual({
        message: "The server had an error while processing your request. Sorry about that!",
        retryable: true,
        statusCode: undefined,
      });
    });
  });
});

describe("HTTP errors", () => {
  const cases = [
    ["anthropic", 400, "max_tokens: Field required", false],
    ["anthropic", 401, "invalid x-api-key", false],
    ["anthropic", 429, "Number of request tokens has exceeded your per-minute rate limit", true],
    ["anthropic", 529, "Overloaded", true],
    ["openai", 400, "Unsupported value: 'reasoning_effort' does not support 'high' with this model.", false],
    ["openai", 401, "Incorrect API key provided: sk-REDACTED. You can find your API key at https://platform.openai.com/account/api-keys.", false],
    ["openai", 429, "Rate limit reached for gpt-4o in organization org-REDACTED on requests per min (RPM): Limit 3, Used 3, Requested 1.", true],
    ["openai", 500, "The server had an error while processing your request. Sorry about that!", true],
  ] as const;

  it.each(cases)("%s http-%i maps to a ProviderError with message and retryable flag", async (provider, status, message, retryable) => {
    const response = replayHttpError(provider, status);
    const adapter = provider === "anthropic" ? anthropic(response).provider : openai(response).provider;
    const model = provider === "anthropic" ? ANTHROPIC_MODEL : "gpt-4o";
    const error = await failure(collect(adapter, context(model)));
    expect({ provider: error.provider, statusCode: error.statusCode, retryable: error.retryable, message: error.message }).toEqual({
      provider,
      statusCode: status,
      retryable,
      message,
    });
  });
});
