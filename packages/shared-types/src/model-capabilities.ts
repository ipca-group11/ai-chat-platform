/**
 * Model catalogue and capability rules shared by `apps/mfe-chat` and
 * `services/conversation-service` (AICHAT-133). One table, two consumers: the UI uses it
 * to decide which toggles and attachments to offer, the adapters use it to build the
 * request. Keeping a single copy means the two can no longer drift apart.
 *
 * Self-contained on purpose (no imports): the backend loads the compiled output of this
 * file with plain Node ESM, so it must not depend on extensionless relative imports.
 * Every lookup lower-cases the model id first.
 */

export type Provider = "ollama" | "openai" | "anthropic";

export const PROVIDERS: readonly Provider[] = ["anthropic", "openai", "ollama"];

/** The models the UI offers per provider. */
export const PROVIDER_MODELS: Record<Provider, readonly string[]> = {
  // Local models served by Ollama; no API key needed.
  ollama: ["llama3.2:1b", "llama3.2:3b", "llama3.1:8b", "qwen3:4b", "qwen3:8b", "deepseek-r1:8b"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-5-mini", "o4-mini"],
  anthropic: [
    "claude-opus-5-5",
    "claude-sonnet-5-5",
    "claude-haiku-4-5",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
  ],
};

/** Substrings that mark a model as able to read images (matched against the lower-cased id). */
export const VISION_MODEL_HINTS: Record<Provider, readonly string[]> = {
  anthropic: ["claude-3", "claude-4", "claude-opus", "claude-sonnet", "claude-haiku"],
  openai: ["gpt-4o", "gpt-4-vision", "gpt-4.1", "gpt-5", "o4"],
  ollama: ["llava", "vision", "bakllava"],
};

/** OpenAI reasoning models: the o-series (o1, o3, o4-mini, ...) and GPT-5 and later. */
export const OPENAI_REASONING_MODEL_PATTERN = /^(o\d|gpt-[5-9])/;

/** Ollama thinking models (its `think` option); sending it to any other model is an error. */
export const OLLAMA_REASONING_MODEL_HINTS: readonly string[] = ["qwen3", "deepseek-r1", "gpt-oss", "magistral", "phi4-reasoning"];

/**
 * How each Claude generation turns thinking on and off (first match wins, so the more
 * specific ids come first — e.g. `claude-opus-5-5` before `claude-opus-5`):
 * - `always-on`: thinking can't be disabled (a `disabled` config is a 400); only its
 *   depth is tunable, via `output_config.effort`.
 * - `between-tools`: `adaptive` on; `disabled` is a 400, `between_tools` turns it off.
 * - `adaptive`: `adaptive` on, `disabled` off.
 * - `budget`: older models take a fixed `budget_tokens` and don't think by default.
 */
export type ThinkingStyle = "always-on" | "between-tools" | "adaptive" | "budget";
export const THINKING_STYLES: ReadonlyArray<readonly [hint: string, style: ThinkingStyle]> = [
  ["claude-fable", "always-on"],
  ["claude-mythos", "always-on"],
  ["claude-opus-5-5", "always-on"],
  ["claude-sonnet-5-5", "between-tools"],
  ["claude-opus-5", "adaptive"],
  ["claude-sonnet-5", "adaptive"],
  ["claude-opus-4-8", "adaptive"],
  ["claude-opus-4-7", "adaptive"],
  ["claude-opus-4-6", "adaptive"],
  ["claude-sonnet-4-6", "adaptive"],
  ["claude-opus-4", "budget"],
  ["claude-sonnet-4", "budget"],
  ["claude-haiku-4", "budget"],
  ["claude-3-7-sonnet", "budget"],
];

/**
 * Web fetch tool version per model (first match wins). `web_fetch_20260318` adds dynamic
 * filtering (the model trims fetched pages with code before reading them) and needs
 * Claude 4.6 or later; older models get the basic `web_fetch_20250910`.
 */
export const WEB_FETCH_TOOLS: ReadonlyArray<readonly [hint: string, type: string]> = [
  ["claude-fable", "web_fetch_20260318"],
  ["claude-mythos", "web_fetch_20260318"],
  ["claude-opus-5", "web_fetch_20260318"],
  ["claude-sonnet-5", "web_fetch_20260318"],
  ["claude-opus-4-8", "web_fetch_20260318"],
  ["claude-opus-4-7", "web_fetch_20260318"],
  ["claude-opus-4-6", "web_fetch_20260318"],
  ["claude-sonnet-4-6", "web_fetch_20260318"],
  ["claude-opus-4", "web_fetch_20250910"],
  ["claude-sonnet-4", "web_fetch_20250910"],
  ["claude-haiku-4", "web_fetch_20250910"],
  ["claude-3-7-sonnet", "web_fetch_20250910"],
];

/** Thinking style of a Claude model, or `undefined` when it has no reasoning mode. */
export function thinkingStyle(model: string): ThinkingStyle | undefined {
  const lower = model.toLowerCase();
  return THINKING_STYLES.find(([hint]) => lower.includes(hint))?.[1];
}

/** Web fetch tool type to send for a Claude model, or `undefined` when it can't fetch. */
export function webFetchToolType(model: string): string | undefined {
  const lower = model.toLowerCase();
  return WEB_FETCH_TOOLS.find(([hint]) => lower.includes(hint))?.[1];
}

export function supportsReasoning(provider: Provider, model: string): boolean {
  const lower = model.toLowerCase();
  if (provider === "anthropic") return thinkingStyle(model) !== undefined;
  if (provider === "ollama") return OLLAMA_REASONING_MODEL_HINTS.some((hint) => lower.includes(hint));
  return OPENAI_REASONING_MODEL_PATTERN.test(lower);
}

/** Only Anthropic offers a web fetch tool. */
export function supportsWebFetch(provider: Provider, model: string): boolean {
  return provider === "anthropic" && webFetchToolType(model) !== undefined;
}

export function supportsVision(provider: Provider, model: string): boolean {
  const lower = model.toLowerCase();
  return VISION_MODEL_HINTS[provider].some((hint) => lower.includes(hint));
}
