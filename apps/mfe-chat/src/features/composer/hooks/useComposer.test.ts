import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "../../../test/utils";
import { useComposer } from "./useComposer";

vi.mock("../../chat-view/model/stream-registry", () => ({
  ensureChatStream: vi.fn(),
}));

describe("useComposer", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("does nothing when send() is called while there is nothing to send", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useComposer({ chatId: "chat-1", userId: "user-1", provider: "ollama", model: "llama3.2:1b" }), {
      wrapper: withQueryClient(),
    });

    expect(result.current.canSend).toBe(false);
    result.current.send();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
