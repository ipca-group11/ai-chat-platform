import {
  ProviderError,
  type LlmProvider,
  type LlmStreamChunk,
  type SendMessageContext,
  type SendMessageOptions,
} from "./types.js";
import { readSseData } from "./http-stream.js";
import { supportsReasoning, supportsVision } from "@app/shared-types/model-capabilities";

export interface OpenAiProviderConfig {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** OpenAI adapter — POSTs to `/v1/chat/completions` with `stream: true` and parses the
 * SSE `data:` chunks OpenAI's Chat Completions API emits. Requires a per-request API
 * key (ARCHITECTURE.md §6). */
export class OpenAiProvider implements LlmProvider {
  readonly id = "openai" as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAiProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? "https://api.openai.com";
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  supportsVision(model: string): boolean {
    return supportsVision("openai", model);
  }

  supportsReasoning(model: string): boolean {
    return supportsReasoning("openai", model);
  }

  /** Chat Completions has no built-in web fetch tool. */
  supportsWebFetch(): boolean {
    return false;
  }

  /** Chat Completions never returns OpenAI's reasoning text, so only the answer streams. */
  async *sendMessage(context: SendMessageContext, options: SendMessageOptions = {}): AsyncIterable<LlmStreamChunk> {
    if (!context.apiKey) {
      throw new ProviderError("openai", "Missing OpenAI API key", { retryable: false, statusCode: 401 });
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${context.apiKey}`,
        },
        signal: options.signal,
        body: JSON.stringify({
          model: context.model,
          stream: true,
          ...(this.supportsReasoning(context.model)
            ? { reasoning_effort: reasoningEffort(context.model, context.reasoning ?? false) }
            : {}),
          messages: context.messages.map((m) => toOpenAiMessage(m)),
        }),
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throw new ProviderError("openai", "Failed to reach OpenAI", { retryable: true, cause });
    }

    if (!response.ok) {
      throw await toResponseError(response);
    }

    for await (const data of readSseData(response.body)) {
      const parsed = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
        error?: { message?: string; type?: string };
      };
      // A failure after the stream started arrives as a `data: {"error": ...}` event with no
      // `choices` (AICHAT-211). It must fail the answer, not end it as if it were complete.
      if (parsed.error) {
        throw new ProviderError("openai", parsed.error.message ?? "OpenAI stream error", {
          retryable: parsed.error.type !== "invalid_request_error",
        });
      }
      const choice = parsed.choices?.[0];
      const token = choice?.delta?.content;
      if (token) yield token;
      // `length`: the answer hit max_tokens (or the context window) and was cut off (AICHAT-212).
      if (choice?.finish_reason === "length") yield { type: "truncated" };
    }
  }
}

/** Reasoning models always reason to some degree; "off" picks the lowest effort each
 * family accepts: `none` from GPT-5.1 on, `minimal` on GPT-5, `low` on the o-series. */
function reasoningEffort(model: string, reasoning: boolean): string {
  if (reasoning) return "high";
  const lower = model.toLowerCase();
  if (/^gpt-5\.\d/.test(lower) || /^gpt-[6-9]/.test(lower)) return "none";
  if (lower.startsWith("gpt-5")) return "minimal";
  return "low";
}

/** Images are sent as multimodal `content` parts (AC-70); text-only messages keep the
 * plain string shape for backward-compatible request bodies. */
function toOpenAiMessage(message: SendMessageContext["messages"][number]) {
  const images = (message.attachments ?? []).filter((a) => a.kind === "image");
  if (images.length === 0) {
    return { role: message.role, content: message.content };
  }
  return {
    role: message.role,
    content: [
      { type: "text", text: message.content },
      ...images.map((image) => ({
        type: "image_url",
        image_url: { url: `data:${image.mimeType};base64,${image.content}` },
      })),
    ],
  };
}

async function toResponseError(response: Response): Promise<ProviderError> {
  const status = response.status;
  let message = `OpenAI request failed with status ${status}`;
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) message = body.error.message;
  } catch {
    // ignore body parse failures, fall back to generic message
  }
  const retryable = status === 429 || status >= 500;
  return new ProviderError("openai", message, { retryable, statusCode: status });
}
