import { describe, expect, it, vi } from "vitest";
import { mockAbortableStreamResponse } from "../../test-utils/mock-stream.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { OllamaProvider } from "./ollama.provider.js";
import { OpenAiProvider } from "./openai.provider.js";
import type { LlmProvider, SendMessageContext } from "./types.js";

/**
 * AICHAT-200: a Stop must reach the provider request. The queue aborts an AbortSignal; each
 * adapter must hand that signal to `fetch`, and an abort in the middle of a streamed reply must
 * end the stream with an AbortError (the processor saves it as stopped, not failed) without
 * emitting any further token.
 */

const TOKENS = ["one", "two", "three", "four"];

type FetchImpl = typeof fetch;

interface AdapterCase {
  name: string;
  build: (fetchImpl: FetchImpl) => LlmProvider;
  context: SendMessageContext;
  /** The provider's wire format for a reply made of `TOKENS`, one network chunk per event. */
  chunks: string[];
}

const sse = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;

const cases: AdapterCase[] = [
  {
    name: "openai",
    build: (fetchImpl) => new OpenAiProvider({ fetchImpl }),
    context: { messages: [{ role: "user", content: "hi" }], model: "gpt-4o-mini", apiKey: "sk-test" },
    chunks: [...TOKENS.map((t) => sse({ choices: [{ delta: { content: t } }] })), "data: [DONE]\n\n"],
  },
  {
    name: "anthropic",
    build: (fetchImpl) => new AnthropicProvider({ fetchImpl }),
    context: { messages: [{ role: "user", content: "hi" }], model: "claude-haiku-4-5", apiKey: "sk-ant-test" },
    chunks: [
      sse({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
      ...TOKENS.map((t) => sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } })),
      sse({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
      sse({ type: "message_stop" }),
    ],
  },
  {
    name: "ollama",
    build: (fetchImpl) => new OllamaProvider({ baseUrl: "http://localhost:11434", fetchImpl }),
    context: { messages: [{ role: "user", content: "hi" }], model: "llama3.2:1b" },
    chunks: [...TOKENS.map((t) => `${JSON.stringify({ message: { content: t } })}\n`), `${JSON.stringify({ done: true })}\n`],
  },
];

/** A fetch that answers with a signal-aware streamed body built from `chunks`. */
function abortableFetch(chunks: string[]) {
  let last: ReturnType<typeof mockAbortableStreamResponse> | undefined;
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    last = mockAbortableStreamResponse(chunks, init?.signal ?? undefined);
    return last.response;
  });
  return { fetchImpl, stream: () => last! };
}

describe.each(cases)("$name adapter: abort (AICHAT-200)", ({ build, context, chunks }) => {
  it("streams the whole reply when nobody stops it (control case)", async () => {
    const { fetchImpl } = abortableFetch(chunks);
    const tokens: unknown[] = [];
    for await (const chunk of build(fetchImpl as unknown as FetchImpl).sendMessage(context, { signal: new AbortController().signal })) {
      tokens.push(chunk);
    }
    expect(tokens).toEqual(TOKENS);
  });

  it("hands the caller's abort signal to fetch", async () => {
    const { fetchImpl } = abortableFetch(chunks);
    const controller = new AbortController();

    for await (const _chunk of build(fetchImpl as unknown as FetchImpl).sendMessage(context, { signal: controller.signal })) {
      // drain
    }

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it("an abort in the middle of the reply ends it with an AbortError and no further token", async () => {
    const { fetchImpl, stream } = abortableFetch(chunks);
    const controller = new AbortController();
    const tokens: unknown[] = [];

    const consume = async () => {
      for await (const chunk of build(fetchImpl as unknown as FetchImpl).sendMessage(context, { signal: controller.signal })) {
        tokens.push(chunk);
        // The user presses Stop right after the first token is shown.
        if (tokens.length === 1) controller.abort();
      }
    };

    await expect(consume()).rejects.toMatchObject({ name: "AbortError" });
    expect(tokens).toEqual(["one"]);
    // The adapter let go of the body: no reader keeps the aborted stream locked.
    expect(stream().body.locked).toBe(false);
  });
});
