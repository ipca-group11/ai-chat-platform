import {
  PROVIDERS,
  providerRequiresApiKey,
  readSessionApiKey,
  readStoredApiKey,
  removeSessionApiKey,
  removeStoredApiKey,
  writeSessionApiKey,
  writeStoredApiKey,
  type Provider,
  type StoredApiKeyRecord,
} from "@app/shared-types/api-keys";
import { useCallback, useEffect, useState } from "react";

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

function readAllForUser(userId: string | undefined): Partial<Record<Provider, StoredApiKeyRecord | null>> {
  if (!userId) {
    return {};
  }
  const next: Partial<Record<Provider, StoredApiKeyRecord | null>> = {};
  for (const provider of PROVIDERS) {
    next[provider] = readStoredApiKey(userId, provider);
  }
  return next;
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
export function useApiKeys(userId: string | undefined): UseApiKeysResult {
  const [records, setRecords] = useState<Partial<Record<Provider, StoredApiKeyRecord | null>>>(
    () => readAllForUser(userId),
  );

  useEffect(() => {
    setRecords(readAllForUser(userId));
  }, [userId]);

  const saveKey = useCallback(
    (provider: Provider, rawKey: string) => {
      if (!userId) {
        return;
      }
      const record = writeStoredApiKey(userId, provider, rawKey);
      writeSessionApiKey(userId, provider, rawKey);
      setRecords((prev) => ({ ...prev, [provider]: record }));
    },
    [userId],
  );

  const removeKey = useCallback(
    (provider: Provider) => {
      if (!userId) {
        return;
      }
      removeStoredApiKey(userId, provider);
      removeSessionApiKey(userId, provider);
      setRecords((prev) => ({ ...prev, [provider]: null }));
    },
    [userId],
  );

  const providers: ProviderKeyState[] = PROVIDERS.map((provider) => ({
    provider,
    requiresKey: providerRequiresApiKey(provider),
    record: records[provider] ?? null,
    usableThisSession: Boolean(userId && records[provider] && readSessionApiKey(userId, provider)),
  }));

  return { providers, saveKey, removeKey };
}
