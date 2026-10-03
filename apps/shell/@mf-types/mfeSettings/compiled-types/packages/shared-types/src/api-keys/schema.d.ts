import { z } from "zod";
/**
 * Providers supported by the LLM configuration feature (FR17-FR20, US-23..US-26).
 *
 * `ollama` never requires an API key; `openai` and `anthropic` do.
 */
export declare const providerSchema: z.ZodEnum<{
    openai: "openai";
    anthropic: "anthropic";
    ollama: "ollama";
}>;
export type Provider = z.infer<typeof providerSchema>;
export declare const PROVIDERS: readonly Provider[];
/** Providers that require the user to configure an API key (AC-76, AC-77). */
export declare const PROVIDERS_REQUIRING_KEY: readonly Provider[];
/** Providers that never require an API key (AC-77). */
export declare const PROVIDERS_WITHOUT_KEY: readonly Provider[];
/** True when `provider` needs an API key configured before use (AC-77). */
export declare function providerRequiresApiKey(provider: Provider): boolean;
/**
 * The record persisted in `localStorage` for a configured provider key.
 *
 * The raw key value is deliberately NOT part of this schema/type: only the last 4
 * characters are retained for masked display (AC-84), satisfying AC-78/AC-79 (keys
 * stay in the browser only, never sent to/stored by a server) by construction — this
 * type is also what would be serialized if any diagnostic/log output were ever
 * generated, so it can never leak a usable key.
 */
export declare const storedApiKeyRecordSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        openai: "openai";
        anthropic: "anthropic";
        ollama: "ollama";
    }>;
    last4: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type StoredApiKeyRecord = z.infer<typeof storedApiKeyRecordSchema>;
/**
 * Header used by browser clients (`mfe-chat`, `mfe-settings`) to send a provider's raw
 * API key to `conversation-service` for a single request (send-message or
 * test-connection). The service must use it once and never persist or log it
 * (AC-81, AC-82, AC-83).
 */
export declare const LLM_API_KEY_HEADER = "X-Llm-Api-Key";
