import type { Provider } from "./types";

/**
 * Which models can reason ("think") before answering, so the reasoning toggle is only
 * offered where it does something. Mirrors `supportsReasoning` in conversation-service's
 * provider adapters, which is authoritative: the server ignores the toggle for any
 * model it doesn't recognise as a reasoning model.
 */
const REASONING_MODEL_PATTERNS: Record<Provider, RegExp> = {
  ollama: /qwen3|deepseek-r1|gpt-oss|magistral|phi4-reasoning/,
  openai: /^(o\d|gpt-[5-9])/,
  anthropic: /claude-(fable|mythos|opus-[45]|sonnet-[45]|haiku-4|3-7-sonnet)/,
};

/**
 * Which models can fetch web pages while answering (Anthropic's web fetch tool). Mirrors
 * `supportsWebFetch` in conversation-service's provider adapters, which is authoritative.
 */
const WEB_FETCH_MODEL_PATTERNS: Record<Provider, RegExp | null> = {
  ollama: null,
  openai: null,
  anthropic: /claude-(fable|mythos|opus-[45]|sonnet-[45]|haiku-4|3-7-sonnet)/,
};

export function supportsWebFetch(provider: Provider, model: string): boolean {
  return WEB_FETCH_MODEL_PATTERNS[provider]?.test(model.toLowerCase()) ?? false;
}

export function supportsReasoning(provider: Provider, model: string): boolean {
  return REASONING_MODEL_PATTERNS[provider].test(model.toLowerCase());
}
