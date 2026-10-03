import { beforeEach, describe, expect, it } from "vitest";

import type { ApiKeyStorage } from "./storage";
import {
  buildApiKeyStorageKey,
  hasStoredApiKey,
  maskStoredApiKey,
  readStoredApiKey,
  removeStoredApiKey,
  writeStoredApiKey,
  readSessionApiKey,
  removeSessionApiKey,
  writeSessionApiKey,
} from "./storage";

/** Simple in-memory fake satisfying the `ApiKeyStorage` shape, for tests. */
function createFakeStorage(): ApiKeyStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("buildApiKeyStorageKey", () => {
  it("AC-78: namespaces the storage key by userId and provider", () => {
    expect(buildApiKeyStorageKey("user-1", "openai")).toBe(
      "llm-api-key:user-1:openai",
    );
  });

  it("throws when userId is empty", () => {
    expect(() => buildApiKeyStorageKey("", "openai")).toThrow();
  });
});

describe("writeStoredApiKey / readStoredApiKey", () => {
  let storage: ApiKeyStorage;

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it("AC-76: saves a new API key and reads it back", () => {
    writeStoredApiKey("user-1", "openai", "sk-abcdefgh1234", storage);
    const record = readStoredApiKey("user-1", "openai", storage);
    expect(record).toEqual({
      provider: "openai",
      last4: "1234",
      createdAt: expect.any(String),
    });
  });

  it("AC-76: updating an existing key overwrites the previous value", () => {
    writeStoredApiKey("user-1", "openai", "sk-first-0000", storage);
    writeStoredApiKey("user-1", "openai", "sk-second-9999", storage);
    const record = readStoredApiKey("user-1", "openai", storage);
    expect(record?.last4).toBe("9999");
  });

  it("AC-79: never persists the raw key value, only the last 4 characters", () => {
    writeStoredApiKey("user-1", "openai", "sk-super-secret-value", storage);
    const raw = storage.getItem(buildApiKeyStorageKey("user-1", "openai"));
    expect(raw).not.toContain("sk-super-secret-value");
    expect(JSON.parse(raw ?? "{}")).toEqual({
      provider: "openai",
      last4: "alue",
      createdAt: expect.any(String),
    });
  });

  it("rejects an empty API key", () => {
    expect(() => writeStoredApiKey("user-1", "openai", "", storage)).toThrow();
    expect(() => writeStoredApiKey("user-1", "openai", "   ", storage)).toThrow();
  });

  it("returns null when no key is configured for a provider", () => {
    expect(readStoredApiKey("user-1", "anthropic", storage)).toBeNull();
  });

  it("AC-80: keys are isolated per user - a different user never sees another user's key", () => {
    writeStoredApiKey("user-1", "openai", "sk-user-one-1111", storage);
    expect(readStoredApiKey("user-2", "openai", storage)).toBeNull();
  });

  it("treats a corrupted stored value as absent and clears it", () => {
    storage.setItem(buildApiKeyStorageKey("user-1", "openai"), "not-json{");
    expect(readStoredApiKey("user-1", "openai", storage)).toBeNull();
    expect(storage.getItem(buildApiKeyStorageKey("user-1", "openai"))).toBeNull();
  });

  it("treats a record whose provider field mismatches the requested key as absent", () => {
    const rawKey = buildApiKeyStorageKey("user-1", "openai");
    storage.setItem(
      rawKey,
      JSON.stringify({
        provider: "anthropic",
        last4: "1234",
        createdAt: new Date().toISOString(),
      }),
    );
    expect(readStoredApiKey("user-1", "openai", storage)).toBeNull();
  });
});

describe("resolveStorage fallback", () => {
  it("falls back to globalThis.localStorage when no storage is passed explicitly", () => {
    const fake = createFakeStorage();
    const globalWithStorage = globalThis as unknown as { localStorage?: ApiKeyStorage };
    const previous = globalWithStorage.localStorage;
    globalWithStorage.localStorage = fake;
    try {
      writeStoredApiKey("user-1", "openai", "sk-global-9999", undefined);
      expect(fake.getItem(buildApiKeyStorageKey("user-1", "openai"))).not.toBeNull();
    } finally {
      globalWithStorage.localStorage = previous;
    }
  });

  it("throws a clear error when no storage is available anywhere", () => {
    const globalWithStorage = globalThis as unknown as { localStorage?: ApiKeyStorage };
    const previous = globalWithStorage.localStorage;
    delete globalWithStorage.localStorage;
    try {
      expect(() => readStoredApiKey("user-1", "openai", undefined)).toThrow(
        "No localStorage available",
      );
    } finally {
      globalWithStorage.localStorage = previous;
    }
  });
});

describe("removeStoredApiKey", () => {
  it("AC-76: removes a previously saved key", () => {
    const storage = createFakeStorage();
    writeStoredApiKey("user-1", "openai", "sk-abcd1234", storage);
    removeStoredApiKey("user-1", "openai", storage);
    expect(readStoredApiKey("user-1", "openai", storage)).toBeNull();
  });

  it("AC-87: after removal, hasStoredApiKey is false so chats will prompt again", () => {
    const storage = createFakeStorage();
    writeStoredApiKey("user-1", "openai", "sk-abcd1234", storage);
    expect(hasStoredApiKey("user-1", "openai", storage)).toBe(true);
    removeStoredApiKey("user-1", "openai", storage);
    expect(hasStoredApiKey("user-1", "openai", storage)).toBe(false);
  });

  it("is safe to call when no key is configured", () => {
    const storage = createFakeStorage();
    expect(() => removeStoredApiKey("user-1", "openai", storage)).not.toThrow();
  });
});

describe("maskStoredApiKey", () => {
  it("AC-84: masks the record, revealing only the last 4 characters", () => {
    const storage = createFakeStorage();
    const record = writeStoredApiKey(
      "user-1",
      "anthropic",
      "sk-ant-abcdefgha1b2",
      storage,
    );
    expect(maskStoredApiKey(record)).toBe("••••a1b2");
    expect(maskStoredApiKey(record)).not.toContain("sk-ant-abcdefgh");
  });
});

describe("session API key", () => {
  it("stores the trimmed raw key per user and provider, apart from the masked record", () => {
    const session = createFakeStorage();
    writeSessionApiKey("user-1", "anthropic", "  sk-ant-raw  ", session);

    expect(readSessionApiKey("user-1", "anthropic", session)).toBe("sk-ant-raw");
    expect(session.getItem("llm-api-key-session:user-1:anthropic")).toBe("sk-ant-raw");
    expect(readSessionApiKey("user-2", "anthropic", session)).toBeNull();

    removeSessionApiKey("user-1", "anthropic", session);
    expect(readSessionApiKey("user-1", "anthropic", session)).toBeNull();
  });

  it("rejects an empty key", () => {
    expect(() => writeSessionApiKey("user-1", "openai", "   ", createFakeStorage())).toThrow();
  });
});
