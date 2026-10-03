import { type Provider, type StoredApiKeyRecord } from "./schema";
/**
 * Minimal storage interface satisfied by `window.localStorage`; accepted as a
 * parameter (rather than hard-coding `window.localStorage`) so callers can inject a
 * fake in tests and so this module stays framework-agnostic (no DOM lib dependency
 * required to type-check outside a browser).
 */
export interface ApiKeyStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/**
 * The `localStorage` key namespace for a user's provider API key:
 * `llm-api-key:{userId}:{provider}`.
 *
 * Namespacing by `userId` ensures keys never leak across accounts on a shared
 * browser (AC-78, AC-80): once a different user is logged in, reads for their
 * `userId` simply never see another user's entries.
 */
export declare function buildApiKeyStorageKey(userId: string, provider: Provider): string;
/**
 * Reads and validates the stored key record for `userId`/`provider`, or `null` if
 * none is configured. Never returns the raw key (only ever stores last4; see
 * `schema.ts`). Corrupted/invalid entries are treated as absent (and removed) rather
 * than thrown, so a bad localStorage value never crashes the settings/chat UI.
 */
export declare function readStoredApiKey(userId: string, provider: Provider, storage?: ApiKeyStorage): StoredApiKeyRecord | null;
/**
 * Saves (adds or updates) the API key for `userId`/`provider`. Only the last 4
 * characters of `rawKey` are persisted; the raw value never leaves this function call
 * (AC-76, AC-78, AC-79).
 */
export declare function writeStoredApiKey(userId: string, provider: Provider, rawKey: string, storage?: ApiKeyStorage): StoredApiKeyRecord;
/**
 * Removes the stored key for `userId`/`provider`, if any (AC-76, AC-87). Safe to call
 * when no key is configured.
 */
export declare function removeStoredApiKey(userId: string, provider: Provider, storage?: ApiKeyStorage): void;
/** True when `userId` has a key configured for `provider` (AC-87). */
export declare function hasStoredApiKey(userId: string, provider: Provider, storage?: ApiKeyStorage): boolean;
/**
 * Masks a stored record for display, e.g. `••••a1b2` — only the last 4 characters are
 * ever shown; the full key is never rendered again after initial entry (AC-84).
 */
export declare function maskStoredApiKey(record: StoredApiKeyRecord): string;
/**
 * The `sessionStorage` key holding a user's raw provider API key:
 * `llm-api-key-session:{userId}:{provider}`. The masked record above only tells the UI
 * that a key was configured; the usable key lives here, for the browser tab session
 * only, and `mfe-chat` reads it to send with each LLM request (FR18, FR19).
 */
export declare function buildSessionApiKeyStorageKey(userId: string, provider: Provider): string;
/** Keeps the raw key for this tab session (trimmed, like the masked record). */
export declare function writeSessionApiKey(userId: string, provider: Provider, rawKey: string, storage?: ApiKeyStorage): void;
/** The raw key usable in this tab session, or `null` when it hasn't been entered here. */
export declare function readSessionApiKey(userId: string, provider: Provider, storage?: ApiKeyStorage): string | null;
export declare function removeSessionApiKey(userId: string, provider: Provider, storage?: ApiKeyStorage): void;
