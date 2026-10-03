import { z } from "zod";

/** LLM providers supported by `conversation-service`'s adapter layer (FR6). */
export const llmProviderSchema = z.enum(["ollama", "openai", "anthropic"]);
export type LlmProvider = z.infer<typeof llmProviderSchema>;

/** Provider + model chosen per chat (persisted, applies to every message in that chat). */
export const providerSelectionSchema = z.object({
  provider: llmProviderSchema,
  model: z.string().min(1),
});
export type ProviderSelection = z.infer<typeof providerSelectionSchema>;

/**
 * Header carrying the user's per-request provider API key (FR19). Read once by the
 * adapter, never logged or persisted (redacted in `pino` serializers).
 */
export const LLM_API_KEY_HEADER = "X-Llm-Api-Key";
