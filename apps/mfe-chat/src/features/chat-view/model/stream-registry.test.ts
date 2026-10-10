import { createTestQueryClient, FakeEventSource, installFakeEventSource } from "@platform/test-utils";
import { http, HttpResponse, server } from "@platform/test-utils/msw";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../shared/query-keys";
import type { Message } from "../../../shared/types";
import {
  __resetStreamRegistryForTests,
  closeChatStream,
  ensureChatStream,
  isChatReconnecting,
  isChatStreaming,
  RECONNECT_DELAY_MS,
} from "./stream-registry";

/** What `GET /chats/:id/messages` returns after the reconnect; counts the requests. */
function serverHas(messages: Partial<Message>[]) {
  const requests: string[] = [];
  server.use(
    http.get("*/chats/:chatId/messages", ({ params }) => {
      requests.push(String(params.chatId));
      // Same envelope as conversation-service: { messages: [...] }.
      return HttpResponse.json({
        messages: messages.map((m) => ({ chatId: params.chatId, role: "assistant", attachments: [], createdAt: "2026-10-10T10:00:00.000Z", ...m })),
      });
    })
  );
  return requests;
}

const cached = (client: ReturnType<typeof createTestQueryClient>, chatId = "chat-1") =>
  client.getQueryData<Message[]>(queryKeys.messages(chatId));

describe("AICHAT-168: connection drop and reconnect (rule: refetch the messages on reconnect)", () => {
  beforeEach(() => {
    installFakeEventSource();
  });

  afterEach(() => {
    __resetStreamRegistryForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the chat as reconnecting from the drop until the stream is open again", () => {
    serverHas([]);
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.last;

    source.emitOpen();
    expect(isChatReconnecting("chat-1")).toBe(false);

    source.emitTransportError();
    expect(isChatReconnecting("chat-1")).toBe(true);

    source.emitOpen();
    expect(isChatReconnecting("chat-1")).toBe(false);
  });

  it("does not refetch on the first open, only on an open that follows a drop", async () => {
    const requests = serverHas([]);
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);

    FakeEventSource.last.emitOpen();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests).toEqual([]);

    FakeEventSource.last.emitTransportError();
    FakeEventSource.last.emitOpen();
    await waitFor(() => expect(requests).toEqual(["chat-1"]));
  });

  it("a reply that finished during the drop is no longer streaming after the reconnect (the 'done' event was lost)", async () => {
    serverHas([{ id: "msg-assistant-1", content: "Hello world", status: "sent", stopped: false }]);
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.last;
    source.emitOpen();
    source.emit("token", { messageId: "msg-assistant-1", token: "Hel" });

    source.emitTransportError();
    // ...the rest of the tokens and `done` are published while the client is away...
    source.emitOpen();

    await waitFor(() => expect(cached(client)?.[0]).toMatchObject({ content: "Hello world", status: "sent" }));
  });

  it("a reply still being generated keeps the text already shown, because the server saves the text only at the end", async () => {
    const requests = serverHas([{ id: "msg-assistant-1", content: "", status: "streaming" }]);
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.last;
    source.emitOpen();
    source.emit("token", { messageId: "msg-assistant-1", token: "Hel" });

    source.emitTransportError();
    source.emitOpen();
    await waitFor(() => expect(requests).toHaveLength(1));
    source.emit("token", { messageId: "msg-assistant-1", token: "lo" });

    expect(cached(client)?.[0]).toMatchObject({ content: "Hello", status: "streaming" });
  });

  it("messages that arrived during the drop (another member's, the next queued one) appear after the reconnect", async () => {
    serverHas([
      { id: "msg-assistant-1", content: "First answer", status: "sent" },
      { id: "msg-user-2", role: "user", content: "Sent by a member while we were away", status: "sent" },
    ]);
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.last;
    source.emitOpen();
    source.emit("token", { messageId: "msg-assistant-1", token: "First" });

    source.emitTransportError();
    source.emitOpen();

    await waitFor(() => expect(cached(client)?.map((m) => m.id)).toEqual(["msg-assistant-1", "msg-user-2"]));
  });

  it("a failed refetch keeps what is shown and does not throw; the next done refetches again", async () => {
    server.use(http.get("*/chats/:chatId/messages", () => HttpResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 })));
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.last;
    source.emitOpen();
    source.emit("token", { messageId: "msg-assistant-1", token: "Hel" });

    source.emitTransportError();
    source.emitOpen();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(cached(client)?.[0]).toMatchObject({ content: "Hel", status: "streaming" });
    source.emit("done", { type: "done", messageId: "msg-assistant-1" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.messages("chat-1") });
  });

  it("when the browser gives up (CLOSED), opens a new stream after a delay, and that open recovers like a reconnect", async () => {
    const requests = serverHas([{ id: "msg-assistant-1", content: "Hello world", status: "sent" }]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const first = FakeEventSource.last;
    first.emitOpen();
    first.emit("token", { messageId: "msg-assistant-1", token: "Hel" });

    first.emitTransportError({ final: true });
    expect(first.closed).toBe(true);
    expect(isChatReconnecting("chat-1")).toBe(true);
    expect(isChatStreaming("chat-1")).toBe(true);

    vi.advanceTimersByTime(RECONNECT_DELAY_MS - 1);
    expect(FakeEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.instances).toHaveLength(2);

    vi.useRealTimers();
    FakeEventSource.last.emitOpen();
    expect(isChatReconnecting("chat-1")).toBe(false);
    await waitFor(() => expect(cached(client)?.[0]).toMatchObject({ content: "Hello world", status: "sent" }));
    expect(requests).toEqual(["chat-1"]);
  });

  it("closing the chat's stream cancels a pending reconnect", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    FakeEventSource.last.emitTransportError({ final: true });

    closeChatStream("chat-1");
    vi.advanceTimersByTime(RECONNECT_DELAY_MS * 2);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(isChatStreaming("chat-1")).toBe(false);
    expect(isChatReconnecting("chat-1")).toBe(false);
  });

  it("a drop in one chat does not mark the other chats as reconnecting", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    ensureChatStream("chat-2", client);

    FakeEventSource.instances[0]!.emitTransportError();

    expect(isChatReconnecting("chat-1")).toBe(true);
    expect(isChatReconnecting("chat-2")).toBe(false);
  });
});

describe("stream-registry (AC-52, AC-55, AC-59, AC-60, AC-61, AC-72, AC-74)", () => {
  beforeEach(() => {
    installFakeEventSource();
  });

  afterEach(() => {
    __resetStreamRegistryForTests();
    vi.unstubAllGlobals();
  });

  it("AC-52: appends streamed tokens incrementally to the assistant message", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("token", { messageId: "msg-assistant-1", token: "Hel" });
    source.emit("token", { messageId: "msg-assistant-1", token: "lo" });

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages).toHaveLength(1);
    expect(messages?.[0]).toMatchObject({ id: "msg-assistant-1", content: "Hello", status: "streaming" });
  });

  it("AC-55/AC-59: on done, finalizes the message and invalidates so the next queued message can be reflected", () => {
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("token", { messageId: "msg-assistant-1", token: "Hi" });
    source.emit("done", { type: "done", messageId: "msg-assistant-1" });

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages?.[0]).toMatchObject({ id: "msg-assistant-1", content: "Hi", status: "sent" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.messages("chat-1") });
  });

  it("AICHAT-202: a done event with stopped marks the reply stopped right away, before any refetch", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("token", { messageId: "msg-assistant-1", token: "Once" });
    source.emit("done", { type: "done", messageId: "msg-assistant-1", stopped: true });

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages?.[0]).toMatchObject({ id: "msg-assistant-1", content: "Once", status: "sent", stopped: true });
  });

  it("AICHAT-202: a done event without stopped leaves the reply unstopped", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("token", { messageId: "msg-assistant-1", token: "Hi" });
    source.emit("done", { type: "done", messageId: "msg-assistant-1" });

    expect(client.getQueryData<Message[]>(queryKeys.messages("chat-1"))?.[0]?.stopped).toBeFalsy();
  });

  it("AC-72/AC-74: on a provider error, marks the message failed without throwing and refetches so the queue can proceed", () => {
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    expect(() =>
      source.emit("error", { type: "error", messageId: "msg-assistant-1", message: "Too many requests", retryable: true })
    ).not.toThrow();

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages?.[0]).toMatchObject({ status: "failed", error: "Too many requests" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.messages("chat-1") });
  });

  it("AC-55: finalizes a message on done even when no token event was seen first", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("done", { type: "done", messageId: "msg-assistant-1" });

    expect(client.getQueryData<Message[]>(queryKeys.messages("chat-1"))).toEqual([
      expect.objectContaining({ id: "msg-assistant-1", role: "assistant", status: "sent" }),
    ]);
  });

  it("AC-72: marks an already-streaming message failed on a later provider error", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("token", { messageId: "msg-assistant-1", token: "Partial" });
    source.emit("error", { type: "error", messageId: "msg-assistant-1", message: "Timed out", retryable: true });

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages).toHaveLength(1);
    expect(messages?.[0]).toMatchObject({ content: "Partial", status: "failed", error: "Timed out" });
  });

  it("shows the assistant reply in its thinking state as soon as the server starts it, before any token", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("started", { type: "started", messageId: "msg-assistant-1" });

    expect(client.getQueryData<Message[]>(queryKeys.messages("chat-1"))).toEqual([
      expect.objectContaining({ id: "msg-assistant-1", role: "assistant", content: "", status: "streaming" }),
    ]);
  });

  it("treats a transport-level error (no data) as a connection error, not a provider failure", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("token", { messageId: "msg-assistant-1", token: "Hi" });
    source.emitTransportError();

    expect(client.getQueryData<Message[]>(queryKeys.messages("chat-1"))?.[0]).toMatchObject({ status: "streaming" });
  });

  it("closeChatStream closes the connection and allows a fresh one to be opened later", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    expect(isChatStreaming("chat-1")).toBe(true);

    closeChatStream("chat-1");

    expect(isChatStreaming("chat-1")).toBe(false);
    expect(FakeEventSource.instances[0]!.closed).toBe(true);

    ensureChatStream("chat-1", client);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("AC-60/AC-61: two chats stream independently, tokens for one never leak into the other", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    ensureChatStream("chat-2", client);
    const [sourceA, sourceB] = FakeEventSource.instances;

    sourceA!.emit("token", { messageId: "msg-a", token: "from A" });
    sourceB!.emit("token", { messageId: "msg-b", token: "from B" });

    expect(client.getQueryData<Message[]>(queryKeys.messages("chat-1"))?.[0]?.content).toBe("from A");
    expect(client.getQueryData<Message[]>(queryKeys.messages("chat-2"))?.[0]?.content).toBe("from B");
    expect(isChatStreaming("chat-1")).toBe(true);
    expect(isChatStreaming("chat-2")).toBe(true);
  });

  it("AC-62: supports at least 5 chats streaming simultaneously, each tracked independently", () => {
    const client = createTestQueryClient();
    const chatIds = ["chat-1", "chat-2", "chat-3", "chat-4", "chat-5"];
    chatIds.forEach((id) => ensureChatStream(id, client));

    FakeEventSource.instances.forEach((source, i) => {
      source.emit("token", { messageId: `msg-${i}`, token: `content-${i}` });
    });

    chatIds.forEach((chatId, i) => {
      expect(client.getQueryData<Message[]>(queryKeys.messages(chatId))?.[0]?.content).toBe(`content-${i}`);
      expect(isChatStreaming(chatId)).toBe(true);
    });
  });

  it("is idempotent: calling ensureChatStream twice for the same chat opens only one connection", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    ensureChatStream("chat-1", client);

    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("appends streamed reasoning separately from the answer", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("reasoning", { messageId: "msg-assistant-1", token: "Let me " });
    source.emit("reasoning", { messageId: "msg-assistant-1", token: "think" });
    source.emit("token", { messageId: "msg-assistant-1", token: "42" });

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages?.[0]).toMatchObject({ reasoning: "Let me think", content: "42", status: "streaming" });
  });

  it("tracks web fetch progress by fetch id", () => {
    const client = createTestQueryClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("web_fetch", { messageId: "msg-assistant-1", fetch: { id: "f1", url: "https://example.com", status: "fetching" } });
    source.emit("web_fetch", { messageId: "msg-assistant-1", fetch: { id: "f1", url: "https://example.com", status: "done", title: "Example" } });
    source.emit("web_fetch", { messageId: "msg-assistant-1", fetch: { id: "f2", url: "https://x.test", status: "fetching" } });

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages?.[0]?.webFetches).toEqual([
      { id: "f1", url: "https://example.com", status: "done", title: "Example" },
      { id: "f2", url: "https://x.test", status: "fetching" },
    ]);
  });
});
