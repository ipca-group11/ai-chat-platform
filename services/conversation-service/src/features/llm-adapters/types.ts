import type { Provider } from "../../shared/contracts/chat.js";

export interface LlmMessageAttachment {
  kind: "text" | "image";
  /** Extracted text content (text/pdf attachments) or base64-encoded bytes (images). */
  content: string;
  mimeType: string;
  filename: string;
}

export interface LlmMessage {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: LlmMessageAttachment[];
}

export interface SendMessageContext {
  /** Full conversation history, oldest first, including the newest user message
   * (AC-53: sent to the LLM as context on every request). */
  messages: LlmMessage[];
  model: string;
  /** Per-request provider API key forwarded from the browser (ARCHITECTURE.md §6). Not
   * required for the Ollama provider. */
  apiKey?: string;
  /** The chat's reasoning toggle. Adapters apply it only when `supportsReasoning(model)`
   * — on: ask the model to think before answering; off: keep thinking to the minimum
   * the model allows. */
  reasoning?: boolean;
  /** The chat's web fetch toggle. Adapters apply it only when `supportsWebFetch(model)`:
   * the model may then fetch the pages behind URLs in the conversation. */
  webFetch?: boolean;
}

/** A piece of the model's reasoning ("thinking"), streamed ahead of (or between) the
 * answer text. Answer text itself is yielded as plain strings. */
export interface LlmReasoningChunk {
  type: "reasoning";
  text: string;
}

/** Progress of one page fetch the model made while answering: `fetching` once the URL
 * is known, then `done` (with the page title when there is one) or `error`. */
export interface LlmWebFetchChunk {
  type: "web_fetch";
  /** Correlates the `fetching` chunk with its outcome. */
  id: string;
  url: string;
  status: "fetching" | "done" | "error";
  title?: string;
  /** Provider error code when `status` is `error`, e.g. `url_not_accessible`. */
  errorCode?: string;
}

/** The answer was cut off because the model reached its output token limit (Anthropic
 * `stop_reason: max_tokens`, OpenAI `finish_reason: length`, Ollama `done_reason: length`).
 * Yielded once, after the last text, so the reply is not saved as a complete answer. */
export interface LlmTruncatedChunk {
  type: "truncated";
}

export type LlmStreamChunk = string | LlmReasoningChunk | LlmWebFetchChunk | LlmTruncatedChunk;

export interface SendMessageOptions {
  signal?: AbortSignal;
}

/**
 * One common interface implemented by every provider adapter (AC-63). The queue/
 * message layer only depends on this interface and `ProviderRegistry`, never on a
 * concrete provider (AC-65).
 */
export interface LlmProvider {
  readonly id: Provider;
  sendMessage(context: SendMessageContext, options?: SendMessageOptions): AsyncIterable<LlmStreamChunk>;
  /** Whether this provider+model combination accepts image input (AC-70/71). */
  supportsVision(model: string): boolean;
  /** Whether this provider+model combination can reason ("think") before answering. */
  supportsReasoning(model: string): boolean;
  /** Whether this provider+model combination can fetch web pages while answering. */
  supportsWebFetch(model: string): boolean;
}

/** Raised by provider adapters on non-retryable/retryable failures so the queue can
 * surface a clear message without crashing (AC-72) and decide whether a retry makes
 * sense (AC-73). */
export class ProviderError extends Error {
  readonly provider: Provider;
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(
    provider: Provider,
    message: string,
    options: { retryable: boolean; statusCode?: number; cause?: unknown } = { retryable: true },
  ) {
    super(message, { cause: options.cause });
    this.name = "ProviderError";
    this.provider = provider;
    this.retryable = options.retryable;
    this.statusCode = options.statusCode;
  }
}
