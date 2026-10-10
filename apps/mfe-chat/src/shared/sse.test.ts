import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { installFakeEventSource, type FakeEventSource } from "@platform/test-utils";
import { subscribeToChatStream, type StreamHandlers } from "./sse";

let Source: typeof FakeEventSource;

function handlers(overrides: Partial<StreamHandlers> = {}) {
  return {
    onToken: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  } satisfies StreamHandlers;
}

beforeEach(() => {
  Source = installFakeEventSource();
});
afterEach(() => vi.unstubAllGlobals());

describe("subscribeToChatStream", () => {
  it("opens one credentialed stream for the chat", () => {
    subscribeToChatStream("chat-1", handlers());
    subscribeToChatStream("chat-2", handlers());

    expect(Source.instances.map((s) => s.url)).toEqual(["/api/chats/chat-1/stream", "/api/chats/chat-2/stream"]);
    expect(Source.instances.every((s) => s.withCredentials)).toBe(true);
  });

  it("hands each named event to its handler, parsed", () => {
    const h = {
      ...handlers(),
      onMessage: vi.fn(),
      onStarted: vi.fn(),
      onReasoning: vi.fn(),
      onWebFetch: vi.fn(),
    };
    subscribeToChatStream("chat-1", h);
    const source = Source.last;
    const fetched = { id: "f1", url: "https://example.test", status: "fetching" };

    source.emit("message", { type: "message", message: { id: "m1" } });
    source.emit("started", { type: "started", messageId: "m2" });
    source.emit("token", { type: "token", messageId: "m2", token: "Hi" });
    source.emit("reasoning", { type: "reasoning", messageId: "m2", token: "hmm" });
    source.emit("web_fetch", { type: "web_fetch", messageId: "m2", fetch: fetched });
    source.emit("done", { type: "done", messageId: "m2" });

    expect(h.onMessage).toHaveBeenCalledWith({ type: "message", message: { id: "m1" } });
    expect(h.onStarted).toHaveBeenCalledWith({ type: "started", messageId: "m2" });
    expect(h.onToken).toHaveBeenCalledWith({ type: "token", messageId: "m2", token: "Hi" });
    expect(h.onReasoning).toHaveBeenCalledWith({ type: "reasoning", messageId: "m2", token: "hmm" });
    expect(h.onWebFetch).toHaveBeenCalledWith({ type: "web_fetch", messageId: "m2", fetch: fetched });
    expect(h.onDone).toHaveBeenCalledWith({ type: "done", messageId: "m2" });
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("ignores optional events the caller did not subscribe to", () => {
    subscribeToChatStream("chat-1", handlers());

    expect(() => {
      Source.last.emit("message", { type: "message" });
      Source.last.emit("started", { type: "started" });
      Source.last.emit("reasoning", { type: "reasoning" });
      Source.last.emit("web_fetch", { type: "web_fetch" });
    }).not.toThrow();
  });

  it("reports a provider failure sent as an error event through onError", () => {
    const h = { ...handlers(), onConnectionError: vi.fn() };
    subscribeToChatStream("chat-1", h);

    Source.last.emit("error", { type: "error", messageId: "m2", message: "Rate limited", retryable: true });

    expect(h.onError).toHaveBeenCalledWith({ type: "error", messageId: "m2", message: "Rate limited", retryable: true });
    expect(h.onConnectionError).not.toHaveBeenCalled();
  });

  it("reports a dropped connection through onConnectionError, not onError", () => {
    const h = { ...handlers(), onConnectionError: vi.fn() };
    subscribeToChatStream("chat-1", h);

    Source.last.emitTransportError();

    expect(h.onConnectionError).toHaveBeenCalledTimes(1);
    expect(h.onConnectionError.mock.calls[0]![0]).toBeInstanceOf(Event);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("treats an error event with an empty payload as a connection problem", () => {
    const h = { ...handlers(), onConnectionError: vi.fn() };
    subscribeToChatStream("chat-1", h);

    Source.last.emit("error", "");

    expect(h.onConnectionError).toHaveBeenCalledTimes(1);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("survives a transport error without a connection handler", () => {
    subscribeToChatStream("chat-1", handlers());

    expect(() => Source.last.emitTransportError()).not.toThrow();
  });

  it("keeps the same connection open across transport errors, so the browser can reconnect and events keep flowing", () => {
    const h = { ...handlers(), onConnectionError: vi.fn() };
    subscribeToChatStream("chat-1", h);
    const source = Source.last;

    source.emitTransportError();
    source.emit("token", { type: "token", messageId: "m2", token: "after reconnect" });

    expect(Source.instances).toHaveLength(1);
    expect(source.closed).toBe(false);
    expect(h.onToken).toHaveBeenCalledWith({ type: "token", messageId: "m2", token: "after reconnect" });
  });

  it("AICHAT-168: reports every open, the first connect and each reconnect, through onOpen", () => {
    const h = { ...handlers(), onOpen: vi.fn() };
    subscribeToChatStream("chat-1", h);

    Source.last.emitOpen();
    Source.last.emitTransportError();
    Source.last.emitOpen();

    expect(h.onOpen).toHaveBeenCalledTimes(2);
  });

  it("AICHAT-168: says whether the browser will reconnect by itself or has given up", () => {
    const h = { ...handlers(), onConnectionError: vi.fn() };
    subscribeToChatStream("chat-1", h);

    Source.last.emitTransportError();
    Source.last.emitTransportError({ final: true });

    expect(h.onConnectionError.mock.calls.map((call) => call[1])).toEqual([{ willReconnect: true }, { willReconnect: false }]);
  });

  it("close() closes only that chat's stream", () => {
    const first = subscribeToChatStream("chat-1", handlers());
    subscribeToChatStream("chat-2", handlers());

    first.close();

    expect(Source.instances.map((s) => s.closed)).toEqual([true, false]);
  });

  it("throws on a malformed event payload instead of passing garbage to the handler", () => {
    const h = handlers();
    subscribeToChatStream("chat-1", h);

    expect(() => Source.last.emit("token", "{not json")).toThrow(SyntaxError);
    expect(h.onToken).not.toHaveBeenCalled();
  });
});
