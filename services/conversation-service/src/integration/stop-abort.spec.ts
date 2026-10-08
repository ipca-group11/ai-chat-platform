/** Stop aborts the upstream provider call (NFR: upstream connection closed <= 1s after Stop,
 * message state stopped). The real app, queue, message processor and OpenAI adapter run
 * against a local mock upstream that streams forever; the test measures how long the
 * upstream socket stays open after `POST /chats/:id/stop`. */
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { ChatsService } from "../features/chats/index.js";
import { OpenAiProvider } from "../features/llm-adapters/openai.provider.js";
import { createMessageProcessor } from "../features/messages/index.js";
import { QueueManager } from "../features/queue/index.js";
import { ChatEventBus } from "../features/streaming/index.js";
import type { SseEvent } from "../shared/contracts/chat.js";
import { LLM_API_KEY_HEADER } from "../shared/contracts/http.js";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../test-utils/build-test-app.js";
import { FakeChatsRepository } from "../test-utils/fake-chats-repository.js";
import { FakeMessagesRepository } from "../test-utils/fake-messages-repository.js";
import { fakeProviderRegistry } from "../test-utils/fake-provider-registry.js";

/** Upstream connection must be closed within this long after Stop. */
const MAX_CLOSE_MS = 1000;

interface MockUpstream {
  baseUrl: string;
  /** Resolves with the time the upstream connection closed (performance.now()). */
  closed: Promise<number>;
  /** Resolves once the first token went out. */
  firstToken: Promise<void>;
  stop(): Promise<void>;
}

/** An OpenAI-compatible chat-completions endpoint that never finishes: one token every 20 ms. */
async function startMockUpstream(): Promise<MockUpstream> {
  let resolveClosed!: (t: number) => void;
  let resolveFirst!: () => void;
  const closed = new Promise<number>((r) => (resolveClosed = r));
  const firstToken = new Promise<void>((r) => (resolveFirst = r));
  const sockets = new Set<import("node:net").Socket>();

  const server = http.createServer((req, res) => {
    req.resume();
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    let n = 0;
    const timer = setInterval(() => {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `tok${n++} ` } }] })}\n\n`);
      if (n === 1) resolveFirst();
    }, 20);
    res.on("close", () => {
      clearInterval(timer);
      resolveClosed(performance.now());
    });
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    closed,
    firstToken,
    stop: () =>
      new Promise<void>((r) => {
        for (const s of sockets) s.destroy();
        server.close(() => r());
      }),
  };
}

/** A real network `fetch` (the global one is disabled in tests) that honours AbortSignal
 * the way undici does: the socket is destroyed and the body rejects with an AbortError. */
function nodeFetch(url: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const signal = init.signal ?? undefined;
    const abortError = () => new DOMException("This operation was aborted", "AbortError");
    if (signal?.aborted) return reject(abortError());

    const req = http.request(String(url), { method: init.method, headers: init.headers as http.OutgoingHttpHeaders }, (res) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          res.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
          res.on("end", () => controller.close());
          res.on("error", () => {});
          signal?.addEventListener("abort", () => {
            controller.error(abortError());
            req.destroy();
          });
        },
        cancel() {
          req.destroy();
        },
      });
      resolve(new Response(body, { status: res.statusCode ?? 200 }));
    });
    req.on("error", (e) => reject(signal?.aborted ? abortError() : e));
    signal?.addEventListener("abort", () => {
      req.destroy();
      reject(abortError());
    });
    req.end(typeof init.body === "string" ? init.body : undefined);
  });
}

describe("Stop aborts the upstream provider (NFR: <=1s, state stopped)", () => {
  let upstream: MockUpstream | undefined;
  afterEach(async () => {
    await upstream?.stop();
    upstream = undefined;
  });

  it(`closes the upstream connection within ${MAX_CLOSE_MS} ms of Stop and marks the reply stopped`, async () => {
    upstream = await startMockUpstream();

    const chatsRepo = new FakeChatsRepository();
    const messagesRepo = new FakeMessagesRepository();
    const bus = new ChatEventBus();
    const providerRegistry = fakeProviderRegistry(new OpenAiProvider({ baseUrl: upstream.baseUrl, fetchImpl: nodeFetch }));
    const queueManager = new QueueManager(
      createMessageProcessor({ messagesRepo, chatsService: new ChatsService(chatsRepo), providerRegistry, bus }),
    );
    const { app } = buildTestApp({ overrides: { chatsRepo, messagesRepo, bus, providerRegistry, queueManager } });

    const chatId = await createChatVia(app, "user-1", { provider: "openai", model: "gpt-4o-mini" });
    const cookie = cookieFor("user-1");
    const events: SseEvent[] = [];
    bus.subscribe(chatId, (e) => events.push(e));

    await request(app)
      .post(`/chats/${chatId}/messages`)
      .set("Cookie", cookie)
      .set(LLM_API_KEY_HEADER, "sk-test")
      .send({ content: "write something very long" })
      .expect(201);

    await upstream.firstToken;
    expect(queueManager.getQueue(chatId).isProcessing).toBe(true);

    const stopRequestedAt = performance.now();
    const res = await request(app).post(`/chats/${chatId}/stop`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ stopped: true });

    const closedAt = await Promise.race([
      upstream.closed,
      new Promise<number>((_, reject) => setTimeout(() => reject(new Error("upstream connection still open 5s after Stop")), 5000)),
    ]);
    const closeMs = closedAt - stopRequestedAt;
    expect(closeMs, `upstream closed ${Math.round(closeMs)} ms after Stop (limit ${MAX_CLOSE_MS} ms)`).toBeLessThanOrEqual(MAX_CLOSE_MS);

    // Message state: the reply ends as stopped (done event flagged stopped), keeps the partial text, is not failed.
    await expect.poll(() => events.some((e) => e.type === "done")).toBe(true);
    const done = events.find((e) => e.type === "done");
    expect(done).toMatchObject({ type: "done", stopped: true });
    expect(events.some((e) => e.type === "error")).toBe(false);

    const assistant = (await messagesRepo.findByChatOrdered(chatId)).find((m) => m.role === "assistant");
    expect(assistant?.status).toBe("sent");
    expect(assistant?.content).toContain("tok0");

    // The chat is free again for the next queued message.
    await expect.poll(() => queueManager.getQueue(chatId).isProcessing).toBe(false);
  });
});
