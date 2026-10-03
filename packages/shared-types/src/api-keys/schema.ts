import { z } from "zod";

/**
 * Providers supported by the LLM configuration feature (FR17-FR20, US-23..US-26).
 *
 * Both `openai` and `anthropic` require an API key.
 */
export const providerSchema = z.enum(["openai", "anthropic"]);

export type Provider = z.infer<typeof providerSchema>;

export const PROVIDERS: readonly Provider[] = providerSchema.options;

/** Providers that require the user to configure an API key (AC-76, AC-77). */
export const PROVIDERS_REQUIRING_KEY: readonly Provider[] = ["openai", "anthropic"];

/** Providers that never require an API key (AC-77). */
export const PROVIDERS_WITHOUT_KEY: readonly Provider[] = [];

/** True when `provider` needs an API key configured before use (AC-77). */
export function providerRequiresApiKey(provider: Provider): boolean {
  return PROVIDERS_REQUIRING_KEY.includes(provider);
}

/**
 * The record persisted in `localStorage` for a configured provider key.
 *
 * The raw key value is deliberately NOT part of this schema/type: only the last 4
 * characters are retained for masked display (AC-84), satisfying AC-78/AC-79 (keys
 * stay in the browser only, never sent to/stored by a server) by construction — this
 * type is also what would be serialized if any diagnostic/log output were ever
 * generated, so it can never leak a usable key.
 */
export const storedApiKeyRecordSchema = z.object({
  provider: providerSchema,
  /** Last (up to) 4 characters of the configured key, used for masked display only. */
  last4: z.string().min(1).max(4),
  /** ISO-8601 timestamp of when the key was saved/last updated. */
  createdAt: z.string().datetime(),
});

export type StoredApiKeyRecord = z.infer<typeof storedApiKeyRecordSchema>;

/**
 * Header used by browser clients (`mfe-chat`, `mfe-settings`) to send a provider's raw
 * API key to `conversation-service` for a single request (send-message or
 * test-connection). The service must use it once and never persist or log it
 * (AC-81, AC-82, AC-83).
 */
// HTTP header name, not a secret (WAIVERS.md W2)
// nosemgrep: node_api_key
export const LLM_API_KEY_HEADER = "X-Llm-Api-Key";
