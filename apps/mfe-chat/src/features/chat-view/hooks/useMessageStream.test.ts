import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "@platform/test-utils";
import { useMessageStream } from "./useMessageStream";

vi.mock("../model/stream-registry", () => ({
  ensureChatStream: vi.fn(),
}));

describe("useMessageStream", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("does not open a stream when there is no chat id yet", async () => {
    const { ensureChatStream } = await import("../model/stream-registry");
    renderHookWithClient(() => useMessageStream(undefined));

    expect(ensureChatStream).not.toHaveBeenCalled();
  });

  it("opens a stream once a chat id is available", async () => {
    const { ensureChatStream } = await import("../model/stream-registry");
    renderHookWithClient(() => useMessageStream("chat-1"));

    expect(ensureChatStream).toHaveBeenCalledWith("chat-1", expect.anything());
  });
});
