import type { Provider } from "../../shared/contracts/chat.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { OllamaProvider } from "./ollama.provider.js";
import { OpenAiProvider } from "./openai.provider.js";
import type { LlmProvider } from "./types.js";

export interface ProviderRegistry {
  get(provider: Provider): LlmProvider;
}

/**
 * Selects the adapter implementation for a chat's configured provider (AC-64). Adding a
 * new provider means adding one adapter class + one entry here — no other module needs
 * to change (AC-65).
 */
export function createProviderRegistry(config: { ollamaBaseUrl: string }): ProviderRegistry {
  const providers: Record<Provider, LlmProvider> = {
    ollama: new OllamaProvider({ baseUrl: config.ollamaBaseUrl }),
    openai: new OpenAiProvider(),
    anthropic: new AnthropicProvider(),
  };

  return {
    get(provider: Provider): LlmProvider {
      const adapter = providers[provider];
      if (!adapter) {
        throw new Error(`No LLM provider adapter registered for "${provider}"`);
      }
      return adapter;
    },
  };
}
