/**
 * AICHAT-169: what the server does when a chat stream drops in the middle of a reply.
 * Runs the real app, queue and processor over a real socket (so the client can disconnect);
 * only the LLM is scripted. It streams "one ", "two " and "three", and waits on a gate before
 * the second and third token, so the test decides exactly when each one is produced.
 *
 * Agreed rule (AICHAT-167): no replay. A new connection gets the events published after it
 * opened; the client refetches the messages to recover what it missed.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SseEvent } from "../shared/contracts/chat.js";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../test-utils/build-test-app.js";
import { ScriptedProvider, fakeProviderRegistry } from "../test-utils/fake-provider-registry.js";

function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { open, opened };
}

function gatedProvider() {
  const second = gate();
  const third = gate();
  const provider = new ScriptedProvider(async function* () {
    yield "one ";
    await second.opened;
    yield "two ";
    await third.opened;
    yield "three";
  });
  return { provider, releaseSecond: second.open, releaseThird: third.open };
}

/** Resolves with the next event of `type` published for the chat. */
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

/** The SSE events a connection received, parsed from the raw `event:`/`data:` frames. */
function parseEvents(raw: string): SseEvent[] {
  return raw
    .split("\n\n")
    .map((frame) => frame.split("\n").find((line) => line.startsWith("data: ")))
    .filter((line): line is string => line !== undefined)
    .map((line) => JSON.parse(line.slice("data: ".length)) as SseEvent);
}

const servers: http.Server[] = [];
afterEach(() => {
  servers.splice(0).forEach((server) => server.close());
});

async function startApp() {
  const gated = gatedProvider();
  const testApp = buildTestApp({ overrides: { queueManager: undefined, providerRegistry: fakeProviderRegistry(gated.provider) } });
  const server = testApp.app.listen(0);
  servers.push(server);
  const port = (server.address() as AddressInfo).port;
  const chatId = await createChatVia(testApp.app, "ana");

  /** Opens `GET /chats/:id/stream` on a real socket; resolves once the response headers arrived. */
  async function connect() {
    let raw = "";
    const req = await new Promise<http.ClientRequest>((resolve, reject) => {
      const r = http.get({ port, path: `/chats/${chatId}/stream`, headers: { Cookie: cookieFor("ana").join("; ") } }, (res) => {
        res.on("data", (chunk: Buffer) => (raw += chunk.toString("utf-8")));
        resolve(r);
      });
      r.on("error", (err) => {
        if (!(err as NodeJS.ErrnoException).code?.includes("ECONNRESET")) reject(err);
      });
    });
    return { events: () => parseEvents(raw), drop: () => req.destroy() };
  }

  const activeStreams = async () => {
    const res = await request(testApp.app).get("/metrics").expect(200);
    return Number(/^active_streams (\d+)$/m.exec(res.text)?.[1]);
  };

  return { ...testApp, ...gated, chatId, connect, activeStreams };
}

const tokens = (events: SseEvent[]) => events.flatMap((e) => (e.type === "token" ? [e.token] : []));

describe("stream drop and reconnect (AICHAT-169)", () => {
  it("a dropped connection is unsubscribed and no longer counted in active_streams", async () => {
    const app = await startApp();
    const client = await app.connect();
    expect(app.bus.subscriberCount(app.chatId)).toBe(1);
    expect(await app.activeStreams()).toBe(1);

    client.drop();

    await vi.waitFor(() => expect(app.bus.subscriberCount(app.chatId)).toBe(0));
    expect(await app.activeStreams()).toBe(0);
  });

  it("the reply keeps being generated while no client is connected, and is saved complete", async () => {
    const app = await startApp();
    const client = await app.connect();
    const firstToken = nextEvent(app.bus, app.chatId, "token");
    await request(app.app).post(`/chats/${app.chatId}/messages`).set("Cookie", cookieFor("ana")).send({ content: "count to three" }).expect(201);
    await firstToken;
    await vi.waitFor(() => expect(tokens(client.events())).toEqual(["one "]));

    client.drop();
    await vi.waitFor(() => expect(app.bus.subscriberCount(app.chatId)).toBe(0));
    const done = nextEvent(app.bus, app.chatId, "done");
    app.releaseSecond();
    app.releaseThird();
    expect(await done).toMatchObject({ type: "done" });

    // What the client reads when it comes back (the agreed recovery is this refetch).
    const res = await request(app.app).get(`/chats/${app.chatId}/messages`).set("Cookie", cookieFor("ana")).expect(200);
    const reply = (res.body as { messages: Array<{ role: string; content: string; status: string }> }).messages.find((m) => m.role === "assistant");
    expect(reply).toMatchObject({ content: "one two three", status: "sent" });
  });

  it("a new connection receives the events published after it opened, and none from before (no replay)", async () => {
    const app = await startApp();
    const first = await app.connect();
    const firstToken = nextEvent(app.bus, app.chatId, "token");
    await request(app.app).post(`/chats/${app.chatId}/messages`).set("Cookie", cookieFor("ana")).send({ content: "count to three" }).expect(201);
    await firstToken;
    // The bus event is in-process; wait for the bytes to reach the client before cutting it.
    await vi.waitFor(() => expect(tokens(first.events())).toEqual(["one "]));
    first.drop();
    await vi.waitFor(() => expect(app.bus.subscriberCount(app.chatId)).toBe(0));

    // Published while nobody is connected: lost for the stream, kept by the processor.
    const secondToken = nextEvent(app.bus, app.chatId, "token");
    app.releaseSecond();
    await secondToken;

    const second = await app.connect();
    const done = nextEvent(app.bus, app.chatId, "done");
    app.releaseThird();
    await done;

    await vi.waitFor(() => expect(second.events().map((e) => e.type)).toEqual(["token", "done"]));
    expect(tokens(second.events())).toEqual(["three"]);
    expect(tokens(first.events())).toEqual(["one "]);
  });
});
