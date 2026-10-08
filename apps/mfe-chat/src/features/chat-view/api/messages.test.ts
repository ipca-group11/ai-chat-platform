import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderHookWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
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
  it("AC-55: fetches the persisted message history for a chat", async () => {
    server.use(http.get("*/chats/:chatId/messages", () => HttpResponse.json({ messages: [userMessage] })));

    const { result } = renderHookWithClient(() => useMessages("chat-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([userMessage]);
  });
});

describe("useSendMessage (AC-51, AC-60)", () => {
  it("AC-51: persists the message immediately and adds it to the cached history", async () => {
    server.use(http.post("*/chats/:chatId/messages", () => HttpResponse.json({ message: userMessage }, { status: 201 })));
    const { ensureChatStream } = await import("../model/stream-registry");

    const { result } = renderHookWithClient(() => useSendMessage());
    result.current.mutate({ chatId: "chat-1", content: "Hello", userId: "user-1", provider: "anthropic" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(userMessage);
    expect(ensureChatStream).toHaveBeenCalledWith("chat-1", expect.anything());
  });
});

describe("useStopMessage (AC-54)", () => {
  // The handler mirrors conversation-service's real route (`POST /chats/:chatId/stop`, messages/routes.ts).
  // It used to mirror the client's own wrong path, which kept this test green while Stop hit a 404 (AICHAT-199).
  it("AC-54: stops a mid-stream response and resyncs history to pick up the saved partial response", async () => {
    server.use(http.post("*/chats/:chatId/stop", () => HttpResponse.json({ stopped: true })));
    const requests = recordRequests();

    const { result } = renderHookWithClient(() => useStopMessage());
    result.current.mutate({ chatId: "chat-1", messageId: "msg-assistant-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["POST /api/chats/chat-1/stop"]);
  });
});

describe("useRetryMessage (AC-73)", () => {
  it("AC-73: retries a failed message and replaces it in the cache with the retried one", async () => {
    const retried: Message = { ...userMessage, id: "msg-assistant-1", role: "assistant", status: "streaming" };
    server.use(http.post("*/chats/:chatId/messages/:messageId/retry", () => HttpResponse.json({ message: retried }, { status: 202 })));

    const client = createTestQueryClient();
    client.setQueryData(["chats", "chat-1", "messages"], [{ ...retried, status: "failed" }]);

    const { result } = renderHookWithClient(() => useRetryMessage(), { queryClient: client });
    result.current.mutate({ chatId: "chat-1", messageId: "msg-assistant-1", userId: "user-1", provider: "anthropic" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<Message[]>(["chats", "chat-1", "messages"])?.[0]?.status).toBe("streaming");
  });
});

describe("useEditQueuedMessage / useCancelQueuedMessage (AC-58)", () => {
  it("AC-58: edits a queued message's content before it is processed", async () => {
    const edited: Message = { ...userMessage, status: "queued", content: "Updated" };
    server.use(http.patch("*/chats/:chatId/messages/:messageId", () => HttpResponse.json({ message: edited })));

    const client = createTestQueryClient();
    client.setQueryData(["chats", "chat-1", "messages"], [{ ...userMessage, status: "queued" }]);

    const { result } = renderHookWithClient(() => useEditQueuedMessage(), { queryClient: client });
    result.current.mutate({ chatId: "chat-1", messageId: "msg-1", content: "Updated" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<Message[]>(["chats", "chat-1", "messages"])?.[0]?.content).toBe("Updated");
  });

  it("AC-58: cancels a queued message before it is processed", async () => {
    const client = createTestQueryClient();
    client.setQueryData(["chats", "chat-1", "messages"], [{ ...userMessage, status: "queued" }]);

    const { result } = renderHookWithClient(() => useCancelQueuedMessage(), { queryClient: client });
    result.current.mutate({ chatId: "chat-1", messageId: "msg-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<Message[]>(["chats", "chat-1", "messages"])).toEqual([]);
  });
});
