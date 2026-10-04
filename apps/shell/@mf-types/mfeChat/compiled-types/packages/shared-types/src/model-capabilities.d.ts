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
export declare const PROVIDERS: readonly Provider[];
/** The models the UI offers per provider. */
export declare const PROVIDER_MODELS: Record<Provider, readonly string[]>;
/** Substrings that mark a model as able to read images (matched against the lower-cased id). */
export declare const VISION_MODEL_HINTS: Record<Provider, readonly string[]>;
/** OpenAI reasoning models: the o-series (o1, o3, o4-mini, ...) and GPT-5 and later. */
export declare const OPENAI_REASONING_MODEL_PATTERN: RegExp;
/** Ollama thinking models (its `think` option); sending it to any other model is an error. */
export declare const OLLAMA_REASONING_MODEL_HINTS: readonly string[];
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
export declare const THINKING_STYLES: ReadonlyArray<readonly [hint: string, style: ThinkingStyle]>;
/**
 * Web fetch tool version per model (first match wins). `web_fetch_20260318` adds dynamic
 * filtering (the model trims fetched pages with code before reading them) and needs
 * Claude 4.6 or later; older models get the basic `web_fetch_20250910`.
 */
export declare const WEB_FETCH_TOOLS: ReadonlyArray<readonly [hint: string, type: string]>;
/** Thinking style of a Claude model, or `undefined` when it has no reasoning mode. */
export declare function thinkingStyle(model: string): ThinkingStyle | undefined;
/** Web fetch tool type to send for a Claude model, or `undefined` when it can't fetch. */
export declare function webFetchToolType(model: string): string | undefined;
export declare function supportsReasoning(provider: Provider, model: string): boolean;
/** Only Anthropic offers a web fetch tool. */
export declare function supportsWebFetch(provider: Provider, model: string): boolean;
export declare function supportsVision(provider: Provider, model: string): boolean;
