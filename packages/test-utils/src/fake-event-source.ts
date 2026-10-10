import { vi } from "vitest";

type Listener = (event: Event) => void;

/**
 * A stand-in for the browser `EventSource` (jsdom has none). Every instance is kept in
 * `FakeEventSource.instances`, and a test pushes server events with `emit`, fails the stream with
 * `error` and checks `closed` after the code under test calls `close()`.
 *
 *   const FakeSource = installFakeEventSource();
 *   openStream("chat-1");
 *   FakeSource.last.emit("token", { messageId: "m1", token: "Hi" });
 *
 * `readyState` follows the browser: CONNECTING until `emitOpen()`, back to CONNECTING after a
 * transport error (the browser retries by itself) and CLOSED after `close()` or a final error.
 */
export class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  static instances: FakeEventSource[] = [];

  /** The most recently opened connection. Throws when none was opened. */
  static get last(): FakeEventSource {
    const source = FakeEventSource.instances.at(-1);
    if (!source) throw new Error("No FakeEventSource was opened");
    return source;
  }

  static reset(): void {
    FakeEventSource.instances = [];
  }

  readonly url: string;
  readonly withCredentials: boolean;
  readyState: number = FakeEventSource.CONNECTING;
  closed = false;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private listeners: Record<string, Listener[]> = {};

  constructor(url: string | URL, init?: EventSourceInit) {
    this.url = String(url);
    this.withCredentials = init?.withCredentials ?? false;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    (this.listeners[type] ??= []).push(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((candidate) => candidate !== listener);
  }

  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  /** The connection is (re)established: the first connect, or the browser's reconnect after a drop. */
  emitOpen(): void {
    this.readyState = FakeEventSource.OPEN;
    const event = new Event("open");
    this.onopen?.(event);
    this.dispatch("open", event);
  }

  /** Delivers a named server event. `data` is sent as JSON unless it is already a string. */
  emit(type: string, data: unknown): void {
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    this.dispatch(type, new MessageEvent(type, { data: payload }));
  }

  /**
   * Delivers a transport-level error: an `error` event that carries no data. By default the browser
   * keeps retrying (CONNECTING); `final: true` is the case where it gives up (CLOSED), for example
   * when the server answers the reconnect with an HTTP error.
   */
  emitTransportError({ final = false }: { final?: boolean } = {}): void {
    this.readyState = final ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING;
    const event = new Event("error");
    this.onerror?.(event);
    this.dispatch("error", event);
  }

  /**
   * Fails the stream. Without arguments it is a dropped connection (same as `emitTransportError`);
   * with a payload it is the `event: error` the server sends for a provider failure.
   */
  error(data?: unknown): void {
    if (data === undefined) this.emitTransportError();
    else this.emit("error", data);
  }

  private dispatch(type: string, event: Event): void {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }
}

/**
 * Replaces the global `EventSource` with `FakeEventSource` and clears the recorded instances.
 * Undo with `vi.unstubAllGlobals()` (vitest restores the real value after the test).
 */
export function installFakeEventSource(): typeof FakeEventSource {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
  return FakeEventSource;
}
