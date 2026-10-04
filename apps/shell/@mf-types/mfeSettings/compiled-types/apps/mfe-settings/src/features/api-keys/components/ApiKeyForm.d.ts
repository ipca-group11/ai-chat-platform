import type { Provider } from "@app/shared-types/api-keys";
export interface ApiKeyFormProps {
    provider: Provider;
    providerLabel: string;
    hasKey: boolean;
    /** Throws when the key could not be stored; the form then shows an error and keeps the input. */
    onSave: (rawKey: string) => void;
    onRemove: () => void;
}
/**
 * Add/update/remove form for a single provider's API key (US-23, AC-76). Only the raw
 * key typed here is ever available in memory — `onSave` hands it to the shared storage
 * helper, which persists only the last 4 characters (AC-78, AC-79); this component
 * itself never re-displays a previously saved raw value (AC-84 — see
 * `MaskedKeyDisplay`, rendered alongside this form by `ProviderList`).
 */
export declare function ApiKeyForm({ provider, providerLabel, hasKey, onSave, onRemove }: ApiKeyFormProps): import("react").JSX.Element;
