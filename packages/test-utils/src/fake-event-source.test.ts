import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEventSource, installFakeEventSource } from "./fake-event-source";

describe("FakeEventSource", () => {
  beforeEach(() => {
    installFakeEventSource();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces the global EventSource and records every connection", () => {
    const first = new EventSource("/chats/a/stream", { withCredentials: true });
    new EventSource("/chats/b/stream");

    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.last.url).toBe("/chats/b/stream");
    expect(first).toBe(FakeEventSource.instances[0]);
    expect((first as unknown as FakeEventSource).withCredentials).toBe(true);
  });

  it("starts every install with an empty list", () => {
    new EventSource("/old");

    installFakeEventSource();

    expect(FakeEventSource.instances).toEqual([]);
    expect(() => FakeEventSource.last).toThrow("No FakeEventSource was opened");
  });

  it("delivers an emitted event to the listeners of that type, with the data as JSON", () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const source = new EventSource("/stream");
    source.addEventListener("token", onToken);
    source.addEventListener("done", onDone);

    FakeEventSource.last.emit("token", { messageId: "m1", token: "Hi" });

    expect(onDone).not.toHaveBeenCalled();
    const event = onToken.mock.calls[0]![0] as MessageEvent<string>;
    expect(JSON.parse(event.data)).toEqual({ messageId: "m1", token: "Hi" });
  });

  it("sends a string as it is", () => {
    const listener = vi.fn();
    new EventSource("/stream").addEventListener("ping", listener);

    FakeEventSource.last.emit("ping", "raw text");

    expect((listener.mock.calls[0]![0] as MessageEvent<string>).data).toBe("raw text");
  });

  it("stops delivering to a listener that was removed", () => {
    const listener = vi.fn();
    const source = new EventSource("/stream");
    source.addEventListener("token", listener);
    source.removeEventListener("token", listener);

    FakeEventSource.last.emit("token", {});

    expect(listener).not.toHaveBeenCalled();
  });

  it("emits a transport error without data, to onerror and to the error listeners", () => {
    const listener = vi.fn();
    const source = new EventSource("/stream");
    source.onerror = vi.fn();
    source.addEventListener("error", listener);

    FakeEventSource.last.emitTransportError();

    expect(source.onerror).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0]).not.toBeInstanceOf(MessageEvent);
  });

  it("error() without a payload is a dropped connection, with a payload a server error event", () => {
    const listener = vi.fn();
    new EventSource("/stream").addEventListener("error", listener);

    FakeEventSource.last.error();
    FakeEventSource.last.error({ type: "error", messageId: "m1", message: "Boom" });

    expect(listener.mock.calls[0]![0]).not.toBeInstanceOf(MessageEvent);
    const served = listener.mock.calls[1]![0] as MessageEvent<string>;
    expect(JSON.parse(served.data)).toEqual({ type: "error", messageId: "m1", message: "Boom" });
  });

  it("marks the connection closed", () => {
    const source = new EventSource("/stream");

    source.close();

    expect(FakeEventSource.last.closed).toBe(true);
    expect(source.readyState).toBe(EventSource.CLOSED);
  });

  it("has the browser's readyState constants, so comparisons never pass on undefined", () => {
    expect([EventSource.CONNECTING, EventSource.OPEN, EventSource.CLOSED]).toEqual([0, 1, 2]);
  });

  it("follows the browser's readyState: connecting, open, connecting again after a drop", () => {
    const source = new EventSource("/stream");
    expect(source.readyState).toBe(EventSource.CONNECTING);

    FakeEventSource.last.emitOpen();
    expect(source.readyState).toBe(EventSource.OPEN);

    FakeEventSource.last.emitTransportError();
    expect(source.readyState).toBe(EventSource.CONNECTING);
  });

  it("emits open to onopen and to the open listeners", () => {
    const listener = vi.fn();
    const source = new EventSource("/stream");
    source.onopen = vi.fn();
    source.addEventListener("open", listener);

    FakeEventSource.last.emitOpen();

    expect(source.onopen).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("a final transport error leaves the connection CLOSED, as when the browser stops retrying", () => {
    const source = new EventSource("/stream");
    let stateSeenByListener: number | undefined;
    source.addEventListener("error", () => (stateSeenByListener = source.readyState));

    FakeEventSource.last.emitTransportError({ final: true });

    expect(stateSeenByListener).toBe(EventSource.CLOSED);
  });
});
