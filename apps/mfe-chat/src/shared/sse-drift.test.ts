import { chat } from "@app/shared-types";
import { SSE_EVENT_TYPES, type SseEvent } from "@app/shared-types/stream-events";
import { FakeEventSource, installFakeEventSource } from "@platform/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeToChatStream } from "./sse";
import type { SSEEvent } from "./types";

/**
 * Drift guard for the stream events (AICHAT-113, fixed in AICHAT-221; docs/AICHAT-20/SSE-DRIFT.md).
 *
 * mfe-chat no longer declares its own event type: `SSEEvent` is the `SseEvent` of
 * `@app/shared-types/stream-events`, the module that describes what conversation-service sends
 * (the service publishes the same type). This test fails when someone brings a local copy back,
 * when the two exports of shared-types differ, or when the chat stops listening to an event.
 */

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const mfeChatUsesTheSharedType: Equal<SSEEvent, SseEvent> = true;

type EventType = SseEvent["type"];
type FieldsOf<K extends EventType> = keyof Extract<SseEvent, { type: K }>;

/** Field names of every event. The type checks make a missing or unknown name a compile error. */
const eventFields = {
  message: ["type", "message"],
  queued: ["type", "messageId"],
  started: ["type", "messageId"],
  token: ["type", "messageId", "token"],
  reasoning: ["type", "messageId", "token"],
  web_fetch: ["type", "messageId", "fetch"],
  done: ["type", "messageId", "stopped", "truncated"],
  error: ["type", "messageId", "message", "retryable"],
} as const satisfies { [K in EventType]: readonly FieldsOf<K>[] };

type UnlistedFields = {
  [K in EventType]: Exclude<FieldsOf<K>, (typeof eventFields)[K][number]>;
}[EventType];
const everyFieldIsListed: [UnlistedFields] extends [never] ? true : never = true;

function sharedTypesFields(): Record<string, string[]> {
  const entries = chat.sseEventSchema.options.map((option) => [option.shape.type.value as string, Object.keys(option.shape)]);
  return Object.fromEntries(entries) as Record<string, string[]>;
}

describe("SSE events of mfe-chat and shared-types", () => {
  beforeEach(() => {
    installFakeEventSource();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the shared type, with every field listed", () => {
    expect(mfeChatUsesTheSharedType).toBe(true);
    expect(everyFieldIsListed).toBe(true);
  });

  it("has no drift: the event names and fields of shared-types are the ones the chat handles", () => {
    expect(sharedTypesFields()).toEqual(Object.fromEntries(Object.entries(eventFields).map(([type, fields]) => [type, [...fields]])));
    expect(Object.keys(eventFields)).toEqual([...SSE_EVENT_TYPES]);
  });

  it("listens to every event the service sends except queued (a refetch shows the queue)", () => {
    const addListener = vi.spyOn(FakeEventSource.prototype, "addEventListener");
    subscribeToChatStream("chat-1", { onToken: () => {}, onDone: () => {}, onError: () => {} });
    const listened = addListener.mock.calls.map(([type]) => type);
    expect(SSE_EVENT_TYPES.filter((type) => !listened.includes(type))).toEqual(["queued"]);
  });
});
