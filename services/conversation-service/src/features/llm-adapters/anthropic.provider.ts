import {
  ProviderError,
  type LlmProvider,
  type LlmStreamChunk,
  type LlmWebFetchChunk,
  type SendMessageContext,
  type SendMessageOptions,
} from "./types.js";
import { readSseData } from "./http-stream.js";
import { messageText } from "./untrusted-content.js";
import { isUrlAllowed, webFetchDomainParams, type WebFetchDomainPolicy } from "./web-fetch-domains.js";
import { supportsReasoning, supportsVision, supportsWebFetch, thinkingStyle, webFetchToolType } from "@app/shared-types/model-capabilities";


const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;
/** Room for thinking plus the answer; `budget_tokens` must stay below `max_tokens`. */
const REASONING_MAX_TOKENS = 16000;
const REASONING_BUDGET_TOKENS = 8000;

/** Caps per reply, so one message can't pull in dozens of pages. */
const WEB_FETCH_MAX_USES = 5;
const WEB_FETCH_MAX_CONTENT_TOKENS = 25000;
/** Server tools run in a server-side loop that stops with `pause_turn` after a set number
 * of steps; the turn is resumed by sending it back, at most this many times. */
const MAX_PAUSE_CONTINUATIONS = 3;
/** Stop reasons that mean the answer was cut off rather than finished (AICHAT-212). */
const TRUNCATING_STOP_REASONS = new Set(["max_tokens", "model_context_window_exceeded"]);

export interface AnthropicProviderConfig {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Sites the model may fetch (AICHAT-242); unrestricted when empty. */
  webFetchDomains?: WebFetchDomainPolicy;
}

/** Anthropic adapter — POSTs to `/v1/messages` with `stream: true` and parses the SSE
 * `content_block_delta` events Anthropic's Messages API emits. Requires a per-request
 * API key (ARCHITECTURE.md §6). System messages are hoisted into the top-level `system`
 * field per Anthropic's API shape. */
export class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic" as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly webFetchDomains: WebFetchDomainPolicy;

  constructor(config: AnthropicProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com";
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.webFetchDomains = config.webFetchDomains ?? {};
  }

  supportsVision(model: string): boolean {
    return supportsVision("anthropic", model);
  }

  supportsReasoning(model: string): boolean {
    return supportsReasoning("anthropic", model);
  }

  supportsWebFetch(model: string): boolean {
    return supportsWebFetch("anthropic", model);
  }

  async *sendMessage(context: SendMessageContext, options: SendMessageOptions = {}): AsyncIterable<LlmStreamChunk> {
    if (!context.apiKey) {
      throw new ProviderError("anthropic", "Missing Anthropic API key", { retryable: false, statusCode: 401 });
    }

    const systemMessages = context.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const turnMessages = context.messages.filter((m) => m.role !== "system").map((m) => toAnthropicMessage(m));
    const webFetchTool = context.webFetch ? webFetchToolType(context.model) : undefined;
    const request = {
      model: context.model,
      stream: true,
      ...reasoningParams(context.model, context.reasoning ?? false),
      ...(systemMessages ? { system: systemMessages } : {}),
      ...(webFetchTool
        ? {
            tools: [
              {
                type: webFetchTool,
                name: "web_fetch",
                max_uses: WEB_FETCH_MAX_USES,
                max_content_tokens: WEB_FETCH_MAX_CONTENT_TOKENS,
                ...webFetchDomainParams(this.webFetchDomains),
              },
            ],
          }
        : {}),
    };

    // The reply so far, echoed back as the assistant turn when the API pauses it.
    const replyBlocks: ContentBlock[] = [];
    for (let continuation = 0; ; continuation++) {
      const messages = replyBlocks.length > 0 ? [...turnMessages, { role: "assistant", content: replyBlocks }] : turnMessages;
      const response = await this.post({ ...request, messages }, context.apiKey, options.signal);
      const turn = yield* streamTurn(response, this.webFetchDomains);
      replyBlocks.push(...turn.blocks);
      if (turn.stopReason && TRUNCATING_STOP_REASONS.has(turn.stopReason)) {
        yield { type: "truncated" };
        return;
      }
      if (turn.stopReason !== "pause_turn" || continuation >= MAX_PAUSE_CONTINUATIONS) return;
    }
  }

  private async post(body: Record<string, unknown>, apiKey: string, signal?: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        signal,
        body: JSON.stringify(body),
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throw new ProviderError("anthropic", "Failed to reach Anthropic", { retryable: true, cause });
    }
    if (!response.ok) {
      throw await toResponseError(response);
    }
    return response;
  }
}

/** A response content block as streamed: `content_block_start` carries the block, deltas
 * fill in its text, thinking, signature or (for tool calls) JSON input. */
type ContentBlock = Record<string, unknown> & { type: string };

interface StreamEvent {
  type?: string;
  index?: number;
  content_block?: ContentBlock;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    signature?: string;
    partial_json?: string;
    citation?: unknown;
    stop_reason?: string;
  };
  error?: { message?: string };
}

/**
 * Streams one Messages API response: yields answer text, reasoning and web fetch progress
 * as they arrive, and returns the complete content blocks plus the stop reason so a
 * paused turn can be resumed.
 */
async function* streamTurn(
  response: Response,
  webFetchDomains: WebFetchDomainPolicy,
): AsyncGenerator<LlmStreamChunk, { blocks: ContentBlock[]; stopReason?: string }> {
  const blocks: ContentBlock[] = [];
  const partialJson = new Map<number, string>();
  // Fetch URLs by tool call id, to label the result (which only carries the URL on success).
  const fetchUrls = new Map<string, string>();
  let stopReason: string | undefined;

  for await (const data of readSseData(response.body)) {
    const event = JSON.parse(data) as StreamEvent;
    const index = event.index ?? 0;
    switch (event.type) {
      case "error":
        throw new ProviderError("anthropic", event.error?.message ?? "Anthropic stream error", { retryable: true });
      case "content_block_start": {
        const block = event.content_block;
        if (!block) break;
        blocks[index] = { ...block };
        if (block.type === "web_fetch_tool_result") {
          const result = webFetchResult(block, fetchUrls);
          // The API applies the domain list itself; a page outside it that still comes back is never
          // used for an answer (AICHAT-242).
          if (result?.status === "done" && !isUrlAllowed(result.url, webFetchDomains)) {
            throw new ProviderError("anthropic", "The model fetched a page outside the allowed web fetch domains; the answer was stopped", {
              retryable: false,
            });
          }
          if (result) yield result;
        }
        break;
      }
      case "content_block_delta": {
        const block = blocks[index];
        const delta = event.delta;
        if (!delta) break;
        if (delta.type === "text_delta" && delta.text) {
          if (block) block.text = String(block.text ?? "") + delta.text;
          yield delta.text;
        } else if (delta.type === "thinking_delta" && delta.thinking) {
          if (block) block.thinking = String(block.thinking ?? "") + delta.thinking;
          yield { type: "reasoning", text: delta.thinking };
        } else if (delta.type === "signature_delta" && block) {
          block.signature = delta.signature;
        } else if (delta.type === "citations_delta" && block) {
          block.citations = [...((block.citations as unknown[] | undefined) ?? []), delta.citation];
        } else if (delta.type === "input_json_delta") {
          partialJson.set(index, (partialJson.get(index) ?? "") + (delta.partial_json ?? ""));
        }
        break;
      }
      case "content_block_stop": {
        const block = blocks[index];
        const json = partialJson.get(index);
        if (block && json) {
          block.input = JSON.parse(json) as unknown;
        }
        if (block?.type === "server_tool_use" && block.name === "web_fetch") {
          const url = (block.input as { url?: unknown } | undefined)?.url;
          if (typeof url === "string") {
            fetchUrls.set(String(block.id), url);
            yield { type: "web_fetch", id: String(block.id), url, status: "fetching" };
          }
        }
        break;
      }
      case "message_delta":
        stopReason = event.delta?.stop_reason ?? stopReason;
        break;
      case "message_stop":
        return { blocks: blocks.filter(isReplayable), stopReason };
    }
  }
  return { blocks: blocks.filter(isReplayable), stopReason };
}

/** The API rejects empty text blocks, which a paused turn can end with. */
function isReplayable(block: ContentBlock | undefined): block is ContentBlock {
  return block !== undefined && !(block.type === "text" && !block.text);
}

function webFetchResult(block: ContentBlock, fetchUrls: Map<string, string>): LlmWebFetchChunk | undefined {
  const id = String(block.tool_use_id);
  const content = block.content as
    | { type?: string; url?: string; error_code?: string; content?: { title?: string } }
    | undefined;
  const url = content?.url ?? fetchUrls.get(id);
  if (!url) return undefined;
  if (content?.type === "web_fetch_result") {
    const title = content.content?.title;
    return { type: "web_fetch", id, url, status: "done", ...(title ? { title } : {}) };
  }
  return { type: "web_fetch", id, url, status: "error", errorCode: content?.error_code ?? "unavailable" };
}

/** Adaptive thinking whose text is streamed back. Newer models return empty thinking
 * text unless asked for a summary; the 4.6 models summarize by default. */
function adaptiveThinking(model: string) {
  return model.toLowerCase().includes("-4-6") ? { type: "adaptive" } : { type: "adaptive", display: "summarized" };
}

/** `max_tokens` plus the thinking settings for the chat's reasoning toggle. With reasoning
 * off, models that can't stop thinking keep their (default, empty) thinking to themselves. */
function reasoningParams(model: string, reasoning: boolean): Record<string, unknown> {
  switch (thinkingStyle(model)) {
    case "always-on":
      return reasoning
        ? { max_tokens: REASONING_MAX_TOKENS, thinking: adaptiveThinking(model), output_config: { effort: "high" } }
        : { max_tokens: REASONING_MAX_TOKENS, output_config: { effort: "low" } };
    case "between-tools":
      return reasoning
        ? { max_tokens: REASONING_MAX_TOKENS, thinking: adaptiveThinking(model) }
        : { max_tokens: DEFAULT_MAX_TOKENS, thinking: { type: "between_tools" } };
    case "adaptive":
      return reasoning
        ? { max_tokens: REASONING_MAX_TOKENS, thinking: adaptiveThinking(model) }
        : { max_tokens: DEFAULT_MAX_TOKENS, thinking: { type: "disabled" } };
    case "budget":
      return reasoning
        ? { max_tokens: REASONING_MAX_TOKENS, thinking: { type: "enabled", budget_tokens: REASONING_BUDGET_TOKENS } }
        : { max_tokens: DEFAULT_MAX_TOKENS };
    default:
      return { max_tokens: DEFAULT_MAX_TOKENS };
  }
}

/** Images are sent as multimodal `content` blocks (AC-70); text-only messages keep the
 * plain string shape. Text and PDF attachments are part of the text, wrapped as untrusted
 * content (AICHAT-244). */
function toAnthropicMessage(message: SendMessageContext["messages"][number]) {
  const images = (message.attachments ?? []).filter((a) => a.kind === "image");
  const text = messageText(message);
  if (images.length === 0) {
    return { role: message.role, content: text };
  }
  return {
    role: message.role,
    content: [
      { type: "text", text },
      ...images.map((image) => ({
        type: "image",
        source: { type: "base64", media_type: image.mimeType, data: image.content },
      })),
    ],
  };
}

async function toResponseError(response: Response): Promise<ProviderError> {
  const status = response.status;
  let message = `Anthropic request failed with status ${status}`;
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) message = body.error.message;
  } catch {
    // ignore body parse failures, fall back to generic message
  }
  const retryable = status === 429 || status >= 500;
  return new ProviderError("anthropic", message, { retryable, statusCode: status });
}
