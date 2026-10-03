import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "../../../test/utils";
import { useMessageStream } from "./useMessageStream";

vi.mock("../model/stream-registry", () => ({
  ensureChatStream: vi.fn(),
}));

describe("useMessageStream", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("does not open a stream when there is no chat id yet", async () => {
    const { ensureChatStream } = await import("../model/stream-registry");
    renderHook(() => useMessageStream(undefined), { wrapper: withQueryClient() });

    expect(ensureChatStream).not.toHaveBeenCalled();
  });

  it("opens a stream once a chat id is available", async () => {
    const { ensureChatStream } = await import("../model/stream-registry");
    renderHook(() => useMessageStream("chat-1"), { wrapper: withQueryClient() });

    expect(ensureChatStream).toHaveBeenCalledWith("chat-1", expect.anything());
  });
});
