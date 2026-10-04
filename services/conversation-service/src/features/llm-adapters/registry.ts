import { parseEnv } from "../../shared/env.js";
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
export function createProviderRegistry(source: NodeJS.ProcessEnv = process.env): ProviderRegistry {
  // `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` override the real API hosts (AICHAT-43);
  // `OLLAMA_BASE_URL` points at a local Ollama server.
  const env = parseEnv(source);
  const providers: Record<Provider, LlmProvider> = {
    ollama: new OllamaProvider({ baseUrl: env.OLLAMA_BASE_URL }),
    openai: new OpenAiProvider({ baseUrl: env.OPENAI_BASE_URL }),
    anthropic: new AnthropicProvider({ baseUrl: env.ANTHROPIC_BASE_URL }),
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
