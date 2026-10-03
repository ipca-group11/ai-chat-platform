import type { Provider } from "@app/shared-types/api-keys";

/** Human-readable display label per provider (US-23/US-24 UI, AC-76, AC-77). */
export const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

/**
 * Copy shown for providers that never require an API key (AC-77): explains *why*
 * there's no input, rather than just hiding one.
 */
export const PROVIDER_NO_KEY_DESCRIPTIONS: Partial<Record<Provider, string>> = {};

export function providerLabel(provider: Provider): string {
  return PROVIDER_LABELS[provider];
}
