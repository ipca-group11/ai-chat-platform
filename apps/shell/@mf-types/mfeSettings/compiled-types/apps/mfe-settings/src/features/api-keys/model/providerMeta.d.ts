import type { Provider } from "@app/shared-types/api-keys";
/** Human-readable display label per provider (US-23/US-24 UI, AC-76, AC-77). */
export declare const PROVIDER_LABELS: Record<Provider, string>;
/**
 * Copy shown for providers that never require an API key (AC-77): explains *why*
 * there's no input, rather than just hiding one.
 */
export declare const PROVIDER_NO_KEY_DESCRIPTIONS: Partial<Record<Provider, string>>;
export declare function providerLabel(provider: Provider): string;
