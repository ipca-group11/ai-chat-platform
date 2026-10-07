/**
 * AICHAT-202: a stopped reply keeps its partial text and still reads as stopped after a reload.
 * Runs through the real app, queue and processor; only the LLM is scripted: it streams one
 * token, then waits until the reply is aborted, as a provider does in the middle of an answer.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { SseEvent } from "../shared/contracts/chat.js";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../test-utils/build-test-app.js";
import { ScriptedProvider, fakeProviderRegistry } from "../test-utils/fake-provider-registry.js";

/** Streams "Once " and then only ends when the reply is aborted. */
const providerThatWaitsForStop = new ScriptedProvider(async function* (_context, options) {
  yield "Once ";
  await new Promise<never>((_resolve, reject) => {
    const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    if (options?.signal?.aborted) abort();
    else options?.signal?.addEventListener("abort", abort, { once: true });
  });
});

/** Resolves with the first event of `type` published for the chat. */
function nextEvent(bus: ReturnType<typeof buildTestApp>["bus"], chatId: string, type: SseEvent["type"]): Promise<SseEvent> {
  return new Promise((resolve) => {
    const unsubscribe = bus.subscribe(chatId, (event) => {
      if (event.type === type) {
        unsubscribe();
        resolve(event);
      }
    });
  });
}

describe("stopped reply (AICHAT-202)", () => {
  it("a reply stopped mid-stream is read back with stopped: true and its partial text", async () => {
    // No queueManager override: the app builds the real queue and processor.
    const { app, bus } = buildTestApp({ overrides: { queueManager: undefined, providerRegistry: fakeProviderRegistry(providerThatWaitsForStop) } });
    const chatId = await createChatVia(app, "ana");

    const firstToken = nextEvent(bus, chatId, "token");
    const done = nextEvent(bus, chatId, "done");
    await request(app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("ana")).send({ content: "Tell me a story" }).expect(201);
    await firstToken;
    await request(app).post(`/chats/${chatId}/stop`).set("Cookie", cookieFor("ana")).expect(200, { stopped: true });
    expect(await done).toMatchObject({ type: "done", stopped: true });

    // The reload: a fresh read of the history.
    const res = await request(app).get(`/chats/${chatId}/messages`).set("Cookie", cookieFor("ana")).expect(200);
    const messages = (res.body as { messages: Array<{ role: string; content: string; status: string; stopped: boolean }> }).messages;
    const reply = messages.find((m) => m.role === "assistant");
    expect(reply).toMatchObject({ content: "Once ", status: "sent", stopped: true });
    expect(messages.find((m) => m.role === "user")).toMatchObject({ stopped: false });
  });

  it("a reply that finishes on its own is read back with stopped: false", async () => {
    const finishes = new ScriptedProvider(async function* () {
      yield "The end.";
    });
    const { app, bus } = buildTestApp({ overrides: { queueManager: undefined, providerRegistry: fakeProviderRegistry(finishes) } });
    const chatId = await createChatVia(app, "ana");

    const done = nextEvent(bus, chatId, "done");
    await request(app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("ana")).send({ content: "hi" }).expect(201);
    expect(await done).not.toHaveProperty("stopped", true);

    const res = await request(app).get(`/chats/${chatId}/messages`).set("Cookie", cookieFor("ana")).expect(200);
    const reply = (res.body as { messages: Array<{ role: string; content: string; stopped: boolean }> }).messages.find((m) => m.role === "assistant");
    expect(reply).toMatchObject({ content: "The end.", stopped: false });
  });
});
