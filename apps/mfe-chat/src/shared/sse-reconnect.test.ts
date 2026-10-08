import { createTestQueryClient, FakeEventSource, installFakeEventSource } from "@platform/test-utils";
import { QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetStreamRegistryForTests, ensureChatStream } from "../features/chat-view/model/stream-registry";
import { queryKeys } from "./query-keys";
import type { Message } from "./types";

/**
 * NFR: after an SSE drop the chat resyncs in < 5s with 0 duplicate and 0 lost messages.
 * Time is virtual (vitest fake timers), so the budget is deterministic.
 */
const RESYNC_BUDGET_MS = 5_000;
const BROWSER_RETRY_MS = 3_000; // EventSource default reconnection delay
const SERVER_LATENCY_MS = 250; // time the history endpoint takes to answer
const CHAT = "chat-1";

function msg(id: string, role: Message["role"], content: string): Message {
  return { id, chatId: CHAT, role, content, attachments: [], status: "sent", createdAt: "2026-01-01T00:00:00.000Z" };
}

/** Server-side source of truth: what GET /chats/:id/messages returns. */
let serverMessages: Message[];

beforeEach(() => {
  vi.useFakeTimers();
  installFakeEventSource();
  serverMessages = [msg("m1", "user", "hello"), msg("m2", "assistant", "hi there")];
});

afterEach(() => {
  __resetStreamRegistryForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup() {
  const client = createTestQueryClient();
  // Keep the messages query active (as the mounted chat view does) so invalidation refetches it.
  const observer = new QueryObserver<Message[]>(client, {
    queryKey: queryKeys.messages(CHAT),
    queryFn: () =>
      new Promise<Message[]>((resolve) => {
        const snapshot = structuredClone(serverMessages);
        setTimeout(() => resolve(snapshot), SERVER_LATENCY_MS);
      }),
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  ensureChatStream(CHAT, client);
  return { client, source: FakeEventSource.last, unsubscribe };
}

const cached = (client: ReturnType<typeof createTestQueryClient>) =>
  client.getQueryData<Message[]>(queryKeys.messages(CHAT)) ?? [];

describe("SSE reconnect resync (NFR: <5s, 0 duplicate or lost messages)", () => {
  it("recovers every message persisted during the outage within 5s of the drop", async () => {
    const { client, source, unsubscribe } = setup();
    await vi.advanceTimersByTimeAsync(SERVER_LATENCY_MS);
    expect(cached(client).map((m) => m.id)).toEqual(["m1", "m2"]);

    // Connection drops; while it is down the server persists two more messages the client never sees.
    source.emitTransportError();
    serverMessages.push(msg("m3", "user", "are you there?"), msg("m4", "assistant", "yes"));

    // Browser reconnects after its retry delay; live events flow again.
    await vi.advanceTimersByTimeAsync(BROWSER_RETRY_MS);
    source.emit("message", { type: "message", message: msg("m5", "user", "after reconnect") });
    serverMessages.push(msg("m5", "user", "after reconnect"));

    let resyncedAt: number | null = null;
    const start = BROWSER_RETRY_MS;
    for (let t = start; t <= RESYNC_BUDGET_MS + 1_000; t += 50) {
      if (cached(client).length === serverMessages.length && resyncedAt === null) resyncedAt = t;
      await vi.advanceTimersByTimeAsync(50);
    }

    const ids = cached(client).map((m) => m.id);
    expect(ids, "lost messages after reconnect").toEqual(serverMessages.map((m) => m.id));
    expect(new Set(ids).size, "duplicate messages after reconnect").toBe(ids.length);
    expect(resyncedAt, "resync never completed").not.toBeNull();
    expect(resyncedAt!, `resync took ${resyncedAt}ms`).toBeLessThan(RESYNC_BUDGET_MS);
    unsubscribe();
  });

  it("does not duplicate a message that is replayed after the drop", async () => {
    const { client, source, unsubscribe } = setup();
    await vi.advanceTimersByTimeAsync(SERVER_LATENCY_MS);

    source.emitTransportError();
    await vi.advanceTimersByTimeAsync(BROWSER_RETRY_MS);
    // Server replays events the client already holds, plus one new message.
    source.emit("message", { type: "message", message: msg("m2", "assistant", "hi there") });
    source.emit("message", { type: "message", message: msg("m2", "assistant", "hi there") });
    serverMessages.push(msg("m3", "user", "new"));
    source.emit("message", { type: "message", message: msg("m3", "user", "new") });
    await vi.advanceTimersByTimeAsync(RESYNC_BUDGET_MS);

    const ids = cached(client).map((m) => m.id);
    expect(new Set(ids).size, "duplicate messages after replay").toBe(ids.length);
    expect(ids).toEqual(["m1", "m2", "m3"]);
    unsubscribe();
  });

  it("keeps the stream subscribed (not closed) through a drop so the browser can reconnect", async () => {
    const { source, unsubscribe } = setup();
    source.emitTransportError();
    await vi.advanceTimersByTimeAsync(BROWSER_RETRY_MS);

    expect(source.closed).toBe(false);
    expect(FakeEventSource.instances).toHaveLength(1);
    unsubscribe();
  });
});
