/**
 * AICHAT-188: every event the stream can carry is produced by the real app, queue and processor
 * (only the LLM is scripted), written to the wire by `writeSseEvent` exactly as `GET /chats/:id/stream`
 * does, and parsed back with `sseEventSchema`. The wire frame must be `event: <type>` + `data: <JSON>`,
 * the JSON must match the schema with no unknown field, and all eight event types must appear.
 */
import type { Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { writeSseEvent } from "../features/streaming/index.js";
import { ProviderError } from "../features/llm-adapters/index.js";
import { sseEventSchema, type SseEvent } from "../shared/contracts/chat.js";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../test-utils/build-test-app.js";
import { ScriptedProvider, fakeProviderRegistry } from "../test-utils/fake-provider-registry.js";

const ALL_TYPES: SseEvent["type"][] = ["message", "queued", "started", "token", "reasoning", "web_fetch", "done", "error"];

/** Parses one SSE frame as written on the wire. */
function parseFrame(frame: string): { event: string; data: unknown } {
  const match = /^event: (\w+)\ndata: (.*)\n\n$/s.exec(frame);
  expect(match, `not an SSE frame: ${JSON.stringify(frame)}`).not.toBeNull();
  return { event: match?.[1] ?? "", data: JSON.parse(match?.[2] ?? "null") };
}

function deferred() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("stream events on the wire (AICHAT-188)", () => {
  it("every event type the app writes parses with sseEventSchema, unchanged", async () => {
    const firstReplyMayEnd = deferred();
    let call = 0;
    // Reply 1 uses every chunk kind and waits, so message 2 is queued behind it. Reply 2 fails.
    // Reply 3 runs until it is stopped.
    const provider = new ScriptedProvider(
      async function* (_context, options) {
        call += 1;
        if (call === 1) {
          yield { type: "reasoning", text: "Let me look that up." };
          yield { type: "web_fetch", id: "f1", url: "https://example.com", status: "fetching" };
          yield { type: "web_fetch", id: "f1", url: "https://example.com", status: "done", title: "Example" };
          yield "Hello";
          await firstReplyMayEnd.promise;
          return;
        }
        if (call === 2) throw new ProviderError("anthropic", "The provider is overloaded", { retryable: true });
        yield "Once ";
        await new Promise<never>((_resolve, reject) => {
          const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          if (options?.signal?.aborted) abort();
          else options?.signal?.addEventListener("abort", abort, { once: true });
        });
      },
      { reasoning: true, webFetch: true },
    );
    const { app, bus } = buildTestApp({ overrides: { queueManager: undefined, providerRegistry: fakeProviderRegistry(provider) } });
    const chatId = await createChatVia(app, "ana", { reasoning: true });
    const cookie = cookieFor("ana");

    // The same path as the stream route: every published event goes through writeSseEvent.
    const frames: string[] = [];
    const wire = { write: (chunk: string) => frames.push(chunk) } as unknown as Response;
    const seen: SseEvent[] = [];
    const waiters: Array<() => void> = [];
    bus.subscribe(chatId, (event) => {
      writeSseEvent(wire, event);
      seen.push(event);
      waiters.forEach((wake) => wake());
    });
    const until = (test: () => boolean) =>
      new Promise<void>((resolve) => {
        if (test()) return resolve();
        waiters.push(() => test() && resolve());
      });
    const count = (type: SseEvent["type"]) => seen.filter((event) => event.type === type).length;

    await request(app).post(`/chats/${chatId}/messages`).set("Cookie", cookie).send({ content: "Find example.com" }).expect(201);
    await until(() => count("token") === 1);
    await request(app).post(`/chats/${chatId}/messages`).set("Cookie", cookie).send({ content: "And again" }).expect(201);
    firstReplyMayEnd.release();
    await until(() => count("error") === 1);
    await request(app).post(`/chats/${chatId}/messages`).set("Cookie", cookie).send({ content: "Tell me a story" }).expect(201);
    await until(() => count("token") === 2);
    await request(app).post(`/chats/${chatId}/stop`).set("Cookie", cookie).expect(200, { stopped: true });
    await until(() => seen.some((event) => event.type === "done" && event.stopped === true));

    const parsed = frames.map(parseFrame);
    for (const { event, data } of parsed) {
      expect((data as { type?: string }).type, "the event line names the JSON's type").toBe(event);
      const result = sseEventSchema.safeParse(data);
      expect(result.success, `${event} does not match sseEventSchema: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      expect(result.data, `${event} has a field the schema does not describe`).toEqual(data);
    }
    expect(new Set(parsed.map(({ event }) => event))).toEqual(new Set(ALL_TYPES));
  });

  it("the schema refuses events the client could not handle", () => {
    expect(sseEventSchema.safeParse({ type: "progress", messageId: "m1" }).success).toBe(false);
    expect(sseEventSchema.safeParse({ type: "token", messageId: "m1" }).success).toBe(false);
    expect(sseEventSchema.safeParse({ type: "error", messageId: "m1", message: "x" }).success).toBe(false);
  });
});
