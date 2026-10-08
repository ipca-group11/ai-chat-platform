import type { Provider } from "@app/shared-types/api-keys";

/** Human-readable display label per provider (US-23/US-24 UI, AC-76, AC-77). */
export const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  ollama: "Ollama",
};

export function providerLabel(provider: Provider): string {
  return PROVIDER_LABELS[provider];
}
