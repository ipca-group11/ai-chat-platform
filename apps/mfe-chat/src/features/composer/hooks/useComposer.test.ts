import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "@platform/test-utils";
import { useComposer } from "./useComposer";

vi.mock("../../chat-view/model/stream-registry", () => ({
  ensureChatStream: vi.fn(),
}));

describe("useComposer", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("does nothing when send() is called while there is nothing to send", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithClient(() => useComposer({ chatId: "chat-1", userId: "user-1", provider: "anthropic", model: "claude-3-5-haiku-latest" }));

    expect(result.current.canSend).toBe(false);
    result.current.send();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
