import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../shared/query-keys";
import type { Message } from "../../../shared/types";
import { __resetStreamRegistryForTests, closeChatStream, ensureChatStream, isChatStreaming } from "./stream-registry";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  onerror: ((e: Event) => void) | null = null;
  private listeners: Record<string, Array<(e: MessageEvent) => void>> = {};

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(cb);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    const evt = new MessageEvent(type, { data: JSON.stringify(data) });
    this.listeners[type]?.forEach((cb) => cb(evt));
  }
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("stream-registry (AC-52, AC-55, AC-59, AC-60, AC-61, AC-72, AC-74)", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    __resetStreamRegistryForTests();
    vi.unstubAllGlobals();
  });

  it("AC-52: appends streamed tokens incrementally to the assistant message", () => {
    const client = makeClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("token", { messageId: "msg-assistant-1", token: "Hel" });
    source.emit("token", { messageId: "msg-assistant-1", token: "lo" });

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages).toHaveLength(1);
    expect(messages?.[0]).toMatchObject({ id: "msg-assistant-1", content: "Hello", status: "streaming" });
  });

  it("AC-55/AC-59: on done, finalizes the message and invalidates so the next queued message can be reflected", () => {
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("token", { messageId: "msg-assistant-1", token: "Hi" });
    source.emit("done", { type: "done", messageId: "msg-assistant-1" });

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages?.[0]).toMatchObject({ id: "msg-assistant-1", content: "Hi", status: "sent" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.messages("chat-1") });
  });

  it("AC-72/AC-74: on a provider error, marks the message failed without throwing and refetches so the queue can proceed", () => {
    const client = makeClient();
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
    const client = makeClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("done", { type: "done", messageId: "msg-assistant-1" });

    expect(client.getQueryData<Message[]>(queryKeys.messages("chat-1"))).toEqual([
      expect.objectContaining({ id: "msg-assistant-1", role: "assistant", status: "sent" }),
    ]);
  });

  it("AC-72: marks an already-streaming message failed on a later provider error", () => {
    const client = makeClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("token", { messageId: "msg-assistant-1", token: "Partial" });
    source.emit("error", { type: "error", messageId: "msg-assistant-1", message: "Timed out", retryable: true });

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages).toHaveLength(1);
    expect(messages?.[0]).toMatchObject({ content: "Partial", status: "failed", error: "Timed out" });
  });

  it("shows the assistant reply in its thinking state as soon as the server starts it, before any token", () => {
    const client = makeClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("started", { type: "started", messageId: "msg-assistant-1" });

    expect(client.getQueryData<Message[]>(queryKeys.messages("chat-1"))).toEqual([
      expect.objectContaining({ id: "msg-assistant-1", role: "assistant", content: "", status: "streaming" }),
    ]);
  });

  it("treats a transport-level error (no data) as a connection error, not a provider failure", () => {
    const client = makeClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("token", { messageId: "msg-assistant-1", token: "Hi" });
    (source as unknown as { listeners: Record<string, Array<(e: Event) => void>> }).listeners.error?.forEach((cb) =>
      cb(new Event("error"))
    );

    expect(client.getQueryData<Message[]>(queryKeys.messages("chat-1"))?.[0]).toMatchObject({ status: "streaming" });
  });

  it("closeChatStream closes the connection and allows a fresh one to be opened later", () => {
    const client = makeClient();
    ensureChatStream("chat-1", client);
    expect(isChatStreaming("chat-1")).toBe(true);

    closeChatStream("chat-1");

    expect(isChatStreaming("chat-1")).toBe(false);
    expect(FakeEventSource.instances[0]!.closed).toBe(true);

    ensureChatStream("chat-1", client);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("AC-60/AC-61: two chats stream independently, tokens for one never leak into the other", () => {
    const client = makeClient();
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
    const client = makeClient();
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
    const client = makeClient();
    ensureChatStream("chat-1", client);
    ensureChatStream("chat-1", client);

    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("appends streamed reasoning separately from the answer", () => {
    const client = makeClient();
    ensureChatStream("chat-1", client);
    const source = FakeEventSource.instances[0]!;

    source.emit("reasoning", { messageId: "msg-assistant-1", token: "Let me " });
    source.emit("reasoning", { messageId: "msg-assistant-1", token: "think" });
    source.emit("token", { messageId: "msg-assistant-1", token: "42" });

    const messages = client.getQueryData<Message[]>(queryKeys.messages("chat-1"));
    expect(messages?.[0]).toMatchObject({ reasoning: "Let me think", content: "42", status: "streaming" });
  });

  it("tracks web fetch progress by fetch id", () => {
    const client = makeClient();
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
