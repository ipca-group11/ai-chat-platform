import {
  type Provider,
  type StoredApiKeyRecord,
  storedApiKeyRecordSchema,
} from "./schema";

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
export function buildApiKeyStorageKey(userId: string, provider: Provider): string {
  if (!userId) {
    throw new Error("userId is required to build an API key storage key");
  }
  return `llm-api-key:${userId}:${provider}`;
}

function resolveStorage(storage?: ApiKeyStorage): ApiKeyStorage {
  if (storage) {
    return storage;
  }
  if (typeof globalThis !== "undefined" && (globalThis as { localStorage?: ApiKeyStorage }).localStorage) {
    return (globalThis as unknown as { localStorage: ApiKeyStorage }).localStorage;
  }
  throw new Error(
    "No localStorage available in this environment; pass an ApiKeyStorage explicitly",
  );
}

/**
 * Reads and validates the stored key record for `userId`/`provider`, or `null` if
 * none is configured. Never returns the raw key (only ever stores last4; see
 * `schema.ts`). Corrupted/invalid entries are treated as absent (and removed) rather
 * than thrown, so a bad localStorage value never crashes the settings/chat UI.
 */
export function readStoredApiKey(
  userId: string,
  provider: Provider,
  storage?: ApiKeyStorage,
): StoredApiKeyRecord | null {
  const store = resolveStorage(storage);
  const key = buildApiKeyStorageKey(userId, provider);
  const raw = store.getItem(key);
  if (raw === null) {
    return null;
  }
  try {
    const parsed = storedApiKeyRecordSchema.parse(JSON.parse(raw));
    if (parsed.provider !== provider) {
      return null;
    }
    return parsed;
  } catch {
    store.removeItem(key);
    return null;
  }
}

/**
 * Saves (adds or updates) the API key for `userId`/`provider`. Only the last 4
 * characters of `rawKey` are persisted; the raw value never leaves this function call
 * (AC-76, AC-78, AC-79).
 */
export function writeStoredApiKey(
  userId: string,
  provider: Provider,
  rawKey: string,
  storage?: ApiKeyStorage,
): StoredApiKeyRecord {
  const trimmed = rawKey.trim();
  if (trimmed.length === 0) {
    throw new Error("API key must not be empty");
  }
  const store = resolveStorage(storage);
  const record: StoredApiKeyRecord = storedApiKeyRecordSchema.parse({
    provider,
    last4: trimmed.slice(-4),
    createdAt: new Date().toISOString(),
  });
  store.setItem(buildApiKeyStorageKey(userId, provider), JSON.stringify(record));
  return record;
}

/**
 * Removes the stored key for `userId`/`provider`, if any (AC-76, AC-87). Safe to call
 * when no key is configured.
 */
export function removeStoredApiKey(
  userId: string,
  provider: Provider,
  storage?: ApiKeyStorage,
): void {
  const store = resolveStorage(storage);
  store.removeItem(buildApiKeyStorageKey(userId, provider));
}

/** True when `userId` has a key configured for `provider` (AC-87). */
export function hasStoredApiKey(
  userId: string,
  provider: Provider,
  storage?: ApiKeyStorage,
): boolean {
  return readStoredApiKey(userId, provider, storage) !== null;
}

/**
 * Masks a stored record for display, e.g. `••••a1b2` — only the last 4 characters are
 * ever shown; the full key is never rendered again after initial entry (AC-84).
 */
export function maskStoredApiKey(record: StoredApiKeyRecord): string {
  return `••••${record.last4}`;
}

/**
 * The `sessionStorage` key holding a user's raw provider API key:
 * `llm-api-key-session:{userId}:{provider}`. The masked record above only tells the UI
 * that a key was configured; the usable key lives here, for the browser tab session
 * only, and `mfe-chat` reads it to send with each LLM request (FR18, FR19).
 */
export function buildSessionApiKeyStorageKey(userId: string, provider: Provider): string {
  if (!userId) {
    throw new Error("userId is required to build an API key storage key");
  }
  return `llm-api-key-session:${userId}:${provider}`;
}

function resolveSessionStorage(storage?: ApiKeyStorage): ApiKeyStorage {
  if (storage) {
    return storage;
  }
  if (typeof globalThis !== "undefined" && (globalThis as { sessionStorage?: ApiKeyStorage }).sessionStorage) {
    return (globalThis as unknown as { sessionStorage: ApiKeyStorage }).sessionStorage;
  }
  throw new Error(
    "No sessionStorage available in this environment; pass an ApiKeyStorage explicitly",
  );
}

/** Keeps the raw key for this tab session (trimmed, like the masked record). */
export function writeSessionApiKey(
  userId: string,
  provider: Provider,
  rawKey: string,
  storage?: ApiKeyStorage,
): void {
  const trimmed = rawKey.trim();
  if (trimmed.length === 0) {
    throw new Error("API key must not be empty");
  }
  resolveSessionStorage(storage).setItem(buildSessionApiKeyStorageKey(userId, provider), trimmed);
}

/** The raw key usable in this tab session, or `null` when it hasn't been entered here. */
export function readSessionApiKey(
  userId: string,
  provider: Provider,
  storage?: ApiKeyStorage,
): string | null {
  return resolveSessionStorage(storage).getItem(buildSessionApiKeyStorageKey(userId, provider));
}

export function removeSessionApiKey(
  userId: string,
  provider: Provider,
  storage?: ApiKeyStorage,
): void {
  resolveSessionStorage(storage).removeItem(buildSessionApiKeyStorageKey(userId, provider));
}
