import { type Provider, type StoredApiKeyRecord } from "@app/shared-types/api-keys";
export interface ProviderKeyState {
    provider: Provider;
    requiresKey: boolean;
    record: StoredApiKeyRecord | null;
    /** The raw key was entered in this tab session, so chats can use it. A saved record
     * without it means the key must be entered again (it isn't kept across sessions). */
    usableThisSession: boolean;
}
export interface UseApiKeysResult {
    providers: ProviderKeyState[];
    saveKey: (provider: Provider, rawKey: string) => void;
    removeKey: (provider: Provider) => void;
}
/**
 * CRUD over the provider API keys stored in `localStorage` (US-23/US-24, AC-76..AC-80,
 * AC-87), namespaced by `userId` via the shared `@app/shared-types/api-keys` storage
 * contract. No network calls are made here — add/update/remove only ever touch the
 * browser's `localStorage` (AC-78, AC-79, AC-80 by construction).
 *
 * Re-reads storage whenever `userId` changes so that switching the logged-in user never
 * shows a previously-logged-in user's keys (AC-80).
 */
export declare function useApiKeys(userId: string | undefined): UseApiKeysResult;
