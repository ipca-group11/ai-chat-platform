import {
  ProviderError,
  type LlmProvider,
  type LlmStreamChunk,
  type SendMessageContext,
  type SendMessageOptions,
} from "./types.js";
import { readLines } from "./http-stream.js";
import { supportsReasoning, supportsVision } from "@app/shared-types/model-capabilities";

export interface OllamaProviderConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/** Ollama adapter — POSTs to `/api/chat` with `stream: true` and parses the
 * newline-delimited JSON chunks Ollama emits (ARCHITECTURE.md §5). No API key required. */
export class OllamaProvider implements LlmProvider {
  readonly id = "ollama" as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OllamaProviderConfig) {
    this.baseUrl = config.baseUrl;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  supportsVision(model: string): boolean {
    return supportsVision("ollama", model);
  }

  /** Thinking models (Ollama's `think` option); sending it to any other model is an error. */
  supportsReasoning(model: string): boolean {
    return supportsReasoning("ollama", model);
  }

  /** Ollama has no built-in web fetch tool. */
  supportsWebFetch(): boolean {
    return false;
  }

  async *sendMessage(context: SendMessageContext, options: SendMessageOptions = {}): AsyncIterable<LlmStreamChunk> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: options.signal,
        body: JSON.stringify({
          model: context.model,
          stream: true,
          ...(this.supportsReasoning(context.model) ? { think: thinkOption(context.model, context.reasoning ?? false) } : {}),
          messages: context.messages.map((m) => {
            const images = (m.attachments ?? []).filter((a) => a.kind === "image").map((a) => a.content);
            return { role: m.role, content: m.content, ...(images.length > 0 ? { images } : {}) };
          }),
        }),
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throw toProviderError(cause);
    }

    if (!response.ok) {
      // Ollama explains the failure in the body, e.g. {"error":"model 'x' not found"}.
      const detail = await response
        .json()
        .then((body: unknown) => (body as { error?: unknown }).error)
        .then((error) => (typeof error === "string" ? error : undefined))
        .catch(() => undefined);
      throw new ProviderError("ollama", detail ? `Ollama: ${detail}` : `Ollama request failed with status ${response.status}`, {
        retryable: response.status >= 500 || response.status === 429,
        statusCode: response.status,
      });
    }

    try {
      for await (const line of readLines(response.body)) {
        const parsed = JSON.parse(line) as {
          message?: { content?: string; thinking?: string };
          done?: boolean;
          done_reason?: string;
          error?: string;
        };
        if (parsed.error) {
          throw new ProviderError("ollama", parsed.error, { retryable: true });
        }
        const thinking = parsed.message?.thinking;
        if (thinking) yield { type: "reasoning", text: thinking };
        const token = parsed.message?.content;
        if (token) yield token;
        if (parsed.done) {
          // `length`: the answer hit num_predict (or the context size) and was cut off (AICHAT-212).
          if (parsed.done_reason === "length") yield { type: "truncated" };
          return;
        }
      }
    } catch (cause) {
      if (cause instanceof ProviderError) throw cause;
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throw toProviderError(cause);
    }
  }
}

/** gpt-oss can't turn thinking off and takes a level instead of a boolean. */
function thinkOption(model: string, reasoning: boolean): boolean | string {
  if (model.toLowerCase().includes("gpt-oss")) return reasoning ? "high" : "low";
  return reasoning;
}

function toProviderError(cause: unknown): ProviderError {
  return new ProviderError("ollama", "Failed to reach Ollama", { retryable: true, cause });
}
