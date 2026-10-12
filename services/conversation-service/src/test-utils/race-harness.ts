import { once } from "node:events";
import type { Server } from "node:http";
import request from "supertest";
import type { LlmProvider } from "../features/llm-adapters/index.js";
import type { MessagesRepository } from "../features/messages/index.js";
import type { SseEvent } from "../shared/contracts/chat.js";
import { cookieFor } from "./auth-token.js";
import { buildTestApp } from "./build-test-app.js";
import { FakeMessagesRepository } from "./fake-messages-repository.js";
import { fakeProviderRegistry } from "./fake-provider-registry.js";
import { seededRandom, sleep, withLatency } from "./with-latency.js";

const REPO_METHODS: ReadonlyArray<keyof MessagesRepository> = [
  "create",
  "findByChatOrdered",
  "findByIdAndOwner",
  "findById",
  "updateStatus",
  "updateContent",
  "claimForRetry",
  "updateQueuedContent",
  "delete",
];

/** `none`: the in-memory repository as is. `database`: a seeded 0–2 ms delay before and after
 * every repository call, like a round trip to a database. */
export type Latency = "none" | "database";

/** Waits until `done()` is true, polling every millisecond; fails after `timeoutMs`. */
export async function until(done: () => boolean, what: string, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!done()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await sleep(1);
  }
}

/**
 * The real app, queue and message processor (AICHAT-13), with the in-memory repositories and
 * the given scripted provider, served on 127.0.0.1. One server per run: supertest's default (a
 * server per request on all addresses) can pick a port another local program holds on
 * 127.0.0.1, and the request then reaches that program. Call `close()` when the run ends.
 */
export async function startRaceApp(options: {
  latency: Latency;
  seed: number;
  provider: LlmProvider;
  /** Wraps the repository the app uses, to hold a chosen call and force one interleaving. */
  intercept?: (repo: MessagesRepository, store: FakeMessagesRepository) => MessagesRepository;
}) {
  const random = seededRandom(options.seed);
  const delay = () => (options.latency === "none" ? 0 : Math.floor(random() * 3));
  const store = new FakeMessagesRepository();
  const timed = options.latency === "none" ? store : withLatency(store, REPO_METHODS, delay);
  const messagesRepo = options.intercept ? options.intercept(timed, store) : timed;
  const { app, bus } = buildTestApp({
    overrides: { queueManager: undefined, messagesRepo, providerRegistry: fakeProviderRegistry(options.provider) },
  });
  const server: Server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const as = (user: string) => ({
    post: (path: string) => request(server).post(path).set("Cookie", cookieFor(user)),
    patch: (path: string) => request(server).patch(path).set("Cookie", cookieFor(user)),
    delete: (path: string) => request(server).delete(path).set("Cookie", cookieFor(user)),
  });
  const createChat = async (user = "ana") => {
    const res = await as(user)
      .post("/chats")
      .send({ title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" })
      .expect(201);
    return (res.body as { chat: { id: string } }).chat.id;
  };
  const events = (chatId: string) => {
    const seen: SseEvent[] = [];
    bus.subscribe(chatId, (event) => seen.push(event));
    return seen;
  };

  return {
    store,
    bus,
    /** The seeded delay, also handy to vary when a request is sent. */
    delay,
    random,
    as,
    createChat,
    events,
    send: (chatId: string, content: string, user = "ana") => as(user).post(`/chats/${chatId}/messages`).send({ content }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export type RaceApp = Awaited<ReturnType<typeof startRaceApp>>;
