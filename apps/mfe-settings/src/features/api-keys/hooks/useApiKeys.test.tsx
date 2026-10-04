import { buildApiKeyStorageKey, buildSessionApiKeyStorageKey } from "@app/shared-types/api-keys";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApiKeys } from "./useApiKeys";

describe("useApiKeys", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("AC-76: starts with no record for a provider that has no stored key", () => {
    const { result } = renderHook(() => useApiKeys("user-1"));

    const openai = result.current.providers.find((p) => p.provider === "openai");
    expect(openai?.record).toBeNull();
  });

  it("AC-77: reports ollama as not requiring a key", () => {
    const { result } = renderHook(() => useApiKeys("user-1"));

    const ollama = result.current.providers.find((p) => p.provider === "ollama");
    expect(ollama?.requiresKey).toBe(false);
  });

  it("AC-76: saveKey adds a key and it's reflected in providers", () => {
    const { result } = renderHook(() => useApiKeys("user-1"));

    act(() => {
      result.current.saveKey("openai", "sk-abcd1234");
    });

    const openai = result.current.providers.find((p) => p.provider === "openai");
    expect(openai?.record).toEqual({
      provider: "openai",
      last4: "1234",
      createdAt: expect.any(String),
    });
  });

  it("AC-79: never writes the raw key value into localStorage", () => {
    const { result } = renderHook(() => useApiKeys("user-1"));

    act(() => {
      result.current.saveKey("openai", "sk-super-secret-value");
    });

    const raw = window.localStorage.getItem(buildApiKeyStorageKey("user-1", "openai"));
    expect(raw).not.toContain("sk-super-secret-value");
  });

  it("AC-76: saveKey updates an existing key", () => {
    const { result } = renderHook(() => useApiKeys("user-1"));

    act(() => result.current.saveKey("openai", "sk-first-0000"));
    act(() => result.current.saveKey("openai", "sk-second-9999"));

    const openai = result.current.providers.find((p) => p.provider === "openai");
    expect(openai?.record?.last4).toBe("9999");
  });

  it("AC-76, AC-87: removeKey deletes a stored key", () => {
    const { result } = renderHook(() => useApiKeys("user-1"));

    act(() => result.current.saveKey("openai", "sk-abcd1234"));
    act(() => result.current.removeKey("openai"));

    const openai = result.current.providers.find((p) => p.provider === "openai");
    expect(openai?.record).toBeNull();
  });

  it("AC-80: switching to a different user never exposes the previous user's keys", () => {
    const { result, rerender } = renderHook(({ userId }) => useApiKeys(userId), {
      initialProps: { userId: "user-1" as string | undefined },
    });

    act(() => result.current.saveKey("openai", "sk-user-one-1111"));
    expect(result.current.providers.find((p) => p.provider === "openai")?.record).not.toBeNull();

    rerender({ userId: "user-2" });

    expect(result.current.providers.find((p) => p.provider === "openai")?.record).toBeNull();
  });

  it("returns no records when userId is undefined (not yet resolved)", () => {
    const { result } = renderHook(() => useApiKeys(undefined));

    expect(result.current.providers.every((p) => p.record === null)).toBe(true);
  });

  it("saveKey is a no-op when userId is undefined (session not yet resolved)", () => {
    const { result } = renderHook(() => useApiKeys(undefined));

    act(() => result.current.saveKey("openai", "sk-abcd1234"));

    expect(result.current.providers.find((p) => p.provider === "openai")?.record).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("removeKey is a no-op when userId is undefined (session not yet resolved)", () => {
    const { result } = renderHook(() => useApiKeys(undefined));

    expect(() => act(() => result.current.removeKey("openai"))).not.toThrow();
  });

  it("keeps the usable raw key in sessionStorage only, and removes it with the key", () => {
    const { result } = renderHook(() => useApiKeys("user-1"));

    act(() => result.current.saveKey("anthropic", "  sk-ant-secret  "));
    expect(window.sessionStorage.getItem(buildSessionApiKeyStorageKey("user-1", "anthropic"))).toBe("sk-ant-secret");
    expect(result.current.providers.find((p) => p.provider === "anthropic")?.usableThisSession).toBe(true);

    act(() => result.current.removeKey("anthropic"));
    expect(window.sessionStorage.getItem(buildSessionApiKeyStorageKey("user-1", "anthropic"))).toBeNull();
  });

  it("reports a key saved in an earlier session as not usable until it's entered again", () => {
    const first = renderHook(() => useApiKeys("user-1"));
    act(() => first.result.current.saveKey("anthropic", "sk-ant-secret"));
    first.unmount();
    window.sessionStorage.clear(); // a new tab session

    const { result } = renderHook(() => useApiKeys("user-1"));
    const anthropic = result.current.providers.find((p) => p.provider === "anthropic");
    expect(anthropic?.record).not.toBeNull();
    expect(anthropic?.usableThisSession).toBe(false);
  });

  describe("when the browser refuses to store the key", () => {
    const quotaExceeded = () => new DOMException("The quota has been exceeded.", "QuotaExceededError");
    const refuse = (refused: Storage) => {
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
        if (this === refused) throw quotaExceeded();
        setItem.call(this, key, value);
      });
    };
    const sessionKey = () => window.sessionStorage.getItem(buildSessionApiKeyStorageKey("user-1", "openai"));
    const storedRecord = () => window.localStorage.getItem(buildApiKeyStorageKey("user-1", "openai"));

    afterEach(() => vi.restoreAllMocks());

    it("keeps the previous key whole when the masked record cannot be written", () => {
      const { result } = renderHook(() => useApiKeys("user-1"));
      act(() => result.current.saveKey("openai", "sk-old-1111"));
      const previousRecord = storedRecord();
      refuse(window.localStorage);

      expect(() => act(() => result.current.saveKey("openai", "sk-new-2222"))).toThrow(/quota/i);

      expect(storedRecord()).toBe(previousRecord);
      expect(sessionKey()).toBe("sk-old-1111");
      const openai = result.current.providers.find((p) => p.provider === "openai");
      expect(openai?.record?.last4).toBe("1111");
      expect(openai?.usableThisSession).toBe(true);
    });

    it("leaves no session key behind when there was no key before", () => {
      const { result } = renderHook(() => useApiKeys("user-1"));
      refuse(window.localStorage);

      expect(() => act(() => result.current.saveKey("openai", "sk-new-2222"))).toThrow(/quota/i);

      expect(storedRecord()).toBeNull();
      expect(sessionKey()).toBeNull();
      expect(result.current.providers.find((p) => p.provider === "openai")?.record).toBeNull();
    });

    it("changes nothing when the session key cannot be written", () => {
      const { result } = renderHook(() => useApiKeys("user-1"));
      act(() => result.current.saveKey("openai", "sk-old-1111"));
      const previousRecord = storedRecord();
      refuse(window.sessionStorage);

      expect(() => act(() => result.current.saveKey("openai", "sk-new-2222"))).toThrow(/quota/i);

      expect(storedRecord()).toBe(previousRecord);
      expect(sessionKey()).toBe("sk-old-1111");
    });
  });
});
