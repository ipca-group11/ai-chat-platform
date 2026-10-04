import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { createTestQueryClient, FakeEventSource, installFakeEventSource, renderHookWithClient } from "@platform/test-utils";
import { queryKeys } from "../../../shared/query-keys";
import type { Message } from "../../../shared/types";
import { __resetStreamRegistryForTests, isChatStreaming } from "../model/stream-registry";
import { useMessageStream } from "./useMessageStream";

describe("useMessageStream", () => {
  beforeEach(() => {
    installFakeEventSource();
  });

  afterEach(() => {
    __resetStreamRegistryForTests();
    vi.unstubAllGlobals();
  });

  it("does not open a stream when there is no chat id yet", () => {
    renderHookWithClient(() => useMessageStream(undefined));

    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("opens one stream for the chat once a chat id is available", () => {
    renderHookWithClient(() => useMessageStream("chat-1"));

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.last.url).toMatch(/\/chats\/chat-1\/stream$/);
    expect(FakeEventSource.last.withCredentials).toBe(true);
  });

  it("does not open a second stream when it renders again", () => {
    const { rerender } = renderHookWithClient(() => useMessageStream("chat-1"));

    rerender();

    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("opens a new stream when the chat id changes", () => {
    const { rerender } = renderHookWithClient(({ id }) => useMessageStream(id), { initialProps: { id: "chat-1" } });

    rerender({ id: "chat-2" });

    expect(FakeEventSource.instances.map((source) => source.url.split("/").at(-2))).toEqual(["chat-1", "chat-2"]);
  });

  it("writes the streamed tokens of the chat into the query cache", () => {
    const queryClient = createTestQueryClient();
    renderHookWithClient(() => useMessageStream("chat-1"), { queryClient });

    act(() => {
      FakeEventSource.last.emit("token", { messageId: "reply-1", token: "Hel" });
      FakeEventSource.last.emit("token", { messageId: "reply-1", token: "lo" });
    });

    expect(queryClient.getQueryData<Message[]>(queryKeys.messages("chat-1"))).toEqual([
      expect.objectContaining({ id: "reply-1", content: "Hello", status: "streaming" }),
    ]);
  });

  it("keeps the stream open after unmount so that switching chats never interrupts it", () => {
    const { unmount } = renderHookWithClient(() => useMessageStream("chat-1"));

    unmount();

    expect(FakeEventSource.last.closed).toBe(false);
    expect(isChatStreaming("chat-1")).toBe(true);
  });

  it("survives a dropped connection without throwing", () => {
    renderHookWithClient(() => useMessageStream("chat-1"));

    expect(() => FakeEventSource.last.error()).not.toThrow();
  });
});
