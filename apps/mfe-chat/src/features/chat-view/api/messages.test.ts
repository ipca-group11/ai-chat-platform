import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderHookWithClient, withQueryClient } from "@platform/test-utils";
import { jsonResponse } from "../../../test/utils";
import type { Message } from "../../../shared/types";
import {
  useCancelQueuedMessage,
  useEditQueuedMessage,
  useMessages,
  useRetryMessage,
  useSendMessage,
  useStopMessage,
} from "./messages";

vi.mock("../model/stream-registry", () => ({
  ensureChatStream: vi.fn(),
}));

const userMessage: Message = {
  id: "msg-1",
  chatId: "chat-1",
  role: "user",
  content: "Hello",
  attachments: [],
  status: "sent",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("useMessages (AC-51, AC-55)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("AC-55: fetches the persisted message history for a chat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([userMessage])));

    const { result } = renderHookWithClient(() => useMessages("chat-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([userMessage]);
  });
});

describe("useSendMessage (AC-51, AC-60)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("AC-51: persists the message immediately and adds it to the cached history", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(userMessage, 201)));
    const { ensureChatStream } = await import("../model/stream-registry");

    const { result } = renderHookWithClient(() => useSendMessage());
    result.current.mutate({ chatId: "chat-1", content: "Hello", userId: "user-1", provider: "anthropic" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(userMessage);
    expect(ensureChatStream).toHaveBeenCalledWith("chat-1", expect.anything());
  });
});

describe("useStopMessage (AC-54)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("AC-54: stops a mid-stream response and resyncs history to pick up the saved partial response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithClient(() => useStopMessage());
    result.current.mutate({ chatId: "chat-1", messageId: "msg-assistant-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/chats/chat-1/messages/msg-assistant-1/stop"),
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("useRetryMessage (AC-73)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("AC-73: retries a failed message and replaces it in the cache with the retried one", async () => {
    const retried: Message = { ...userMessage, id: "msg-assistant-1", role: "assistant", status: "streaming" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(retried)));

    const client = createTestQueryClient();
    client.setQueryData(["chats", "chat-1", "messages"], [{ ...retried, status: "failed" }]);
    const wrapper = withQueryClient(client);

    const { result } = renderHook(() => useRetryMessage(), { wrapper });
    result.current.mutate({ chatId: "chat-1", messageId: "msg-assistant-1", userId: "user-1", provider: "anthropic" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<Message[]>(["chats", "chat-1", "messages"])?.[0]?.status).toBe("streaming");
  });
});

describe("useEditQueuedMessage / useCancelQueuedMessage (AC-58)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("AC-58: edits a queued message's content before it is processed", async () => {
    const edited: Message = { ...userMessage, status: "queued", content: "Updated" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(edited)));

    const client = createTestQueryClient();
    client.setQueryData(["chats", "chat-1", "messages"], [{ ...userMessage, status: "queued" }]);
    const wrapper = withQueryClient(client);

    const { result } = renderHook(() => useEditQueuedMessage(), { wrapper });
    result.current.mutate({ chatId: "chat-1", messageId: "msg-1", content: "Updated" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<Message[]>(["chats", "chat-1", "messages"])?.[0]?.content).toBe("Updated");
  });

  it("AC-58: cancels a queued message before it is processed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const client = createTestQueryClient();
    client.setQueryData(["chats", "chat-1", "messages"], [{ ...userMessage, status: "queued" }]);
    const wrapper = withQueryClient(client);

    const { result } = renderHook(() => useCancelQueuedMessage(), { wrapper });
    result.current.mutate({ chatId: "chat-1", messageId: "msg-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<Message[]>(["chats", "chat-1", "messages"])).toEqual([]);
  });
});
