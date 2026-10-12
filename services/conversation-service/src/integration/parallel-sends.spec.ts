/**
 * AICHAT-191: N messages sent to one chat at the same time are each saved once, answered once
 * and in the order they are shown. Runs the real app, queue and processor; only the LLM is
 * scripted (it answers "reply to <question>" and records the history it was given).
 *
 * Each scenario runs twice: against the in-memory repository as it is (every call answers at
 * once) and with a seeded random delay around every repository call, like a database round
 * trip. The delay is what lets two requests overlap between a read and a write; the seed
 * makes a failing run repeatable.
 */
import { once } from "node:events";
import type { Server } from "node:http";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import type { MessagesRepository } from "../features/messages/index.js";
import type { SseEvent } from "../shared/contracts/chat.js";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { FakeMessagesRepository } from "../test-utils/fake-messages-repository.js";
import { ScriptedProvider, fakeProviderRegistry } from "../test-utils/fake-provider-registry.js";
import { seededRandom, sleep, withLatency } from "../test-utils/with-latency.js";

const REPO_METHODS: ReadonlyArray<keyof MessagesRepository> = [
  "create",
  "findByChatOrdered",
  "findByIdAndOwner",
  "findById",
  "updateStatus",
  "updateContent",
  "delete",
];

const RUNS = 50;
const N = 5;

type Latency = "none" | "database";

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

/** Each run is many requests: one server per run, bound to 127.0.0.1. Letting supertest open a
 * server per request on all addresses can pick a port another local program already holds on
 * 127.0.0.1, and the request then reaches that program instead of the app. */
async function setup(latency: Latency, seed: number, script?: (firstTurn: string) => Promise<void>) {
  const random = seededRandom(seed);
  const delay = () => (latency === "none" ? 0 : Math.floor(random() * 3));
  const store = new FakeMessagesRepository();
  const messagesRepo = latency === "none" ? store : withLatency(store, REPO_METHODS, delay);

  /** The history the LLM was given for each reply, in the order the replies started. */
  const histories: string[][] = [];
  const provider = new ScriptedProvider(async function* (context) {
    const turns = context.messages.filter((m) => m.role !== "system").map((m) => `${m.role}:${String(m.content)}`);
    histories.push(turns);
    await script?.(turns[0] ?? "");
    await sleep(delay());
    yield `reply to ${String(context.messages.at(-1)?.content)}`;
  });

  const { app, bus } = buildTestApp({
    overrides: { queueManager: undefined, messagesRepo, providerRegistry: fakeProviderRegistry(provider) },
  });
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await once(server, "listening");

  const send = (chatId: string, content: string) =>
    request(server).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("ana")).send({ content });
  const createChat = async () => {
    const res = await request(server)
      .post("/chats")
      .set("Cookie", cookieFor("ana"))
      .send({ title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" })
      .expect(201);
    return (res.body as { chat: { id: string } }).chat.id;
  };
  return { bus, store, histories, send, createChat };
}

/** Waits until `done()` is true, polling every millisecond; fails after `timeoutMs`. */
async function until(done: () => boolean, what: string, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!done()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await sleep(1);
  }
}

/** Sends N messages to one chat at once and returns everything a check needs. */
async function sendInParallel(latency: Latency, seed: number) {
  // Requests over HTTP never arrive at exactly the same time: a reply that finishes before the
  // last request arrives makes the chat idle again, and that request then rightly starts. The
  // replies wait until every send has been answered, so all N really overlap.
  let answered = 0;
  const { bus, store, histories, send, createChat } = await setup(latency, seed, () =>
    until(() => answered === N, `${N} sends answered (seed ${seed})`),
  );
  const chatId = await createChat();
  const events: SseEvent[] = [];
  bus.subscribe(chatId, (event) => events.push(event));

  const contents = Array.from({ length: N }, (_, i) => `q${i}`);
  const responses = await Promise.all(
    contents.map((content) =>
      send(chatId, content).then((res) => {
        answered += 1;
        return res;
      }),
    ),
  );
  await until(() => events.filter((e) => e.type === "done").length === N, `${N} replies`);

  return { contents, responses, events, histories, stored: await store.findByChatOrdered(chatId) };
}

/** Lists every way the run breaks the US1 rules (empty = consistent). */
function problemsIn(run: Awaited<ReturnType<typeof sendInParallel>>): string[] {
  const problems: string[] = [];
  const { contents, responses, events, histories, stored } = run;

  if (responses.some((r) => r.status !== 201)) problems.push(`statuses ${responses.map((r) => r.status).join(",")}`);
  const said = responses.map((r) => (r.body as { message: { id: string; status: string } }).message);
  const sent = said.filter((m) => m.status === "sent");
  if (sent.length !== 1) problems.push(`${sent.length} responses say "sent" (expected 1, the rest "queued")`);
  const queuedEvents = events.filter((e) => e.type === "queued").length;
  if (queuedEvents !== N - 1) problems.push(`${queuedEvents} "queued" events (expected ${N - 1})`);

  // No duplicates, no gaps: user, reply, user, reply… with every question exactly once.
  const users = stored.filter((m) => m.role === "user");
  if (stored.length !== 2 * N) problems.push(`${stored.length} messages stored (expected ${2 * N})`);
  if ([...users.map((m) => m.content)].sort().join() !== [...contents].sort().join()) problems.push("a question is missing or duplicated");
  stored.forEach((m, i) => {
    const expectedRole = i % 2 === 0 ? "user" : "assistant";
    if (m.role !== expectedRole) problems.push(`message ${i} is ${m.role} (expected ${expectedRole})`);
    if (m.role === "assistant" && m.content !== `reply to ${stored[i - 1]?.content}`) {
      problems.push(`message ${i} "${m.content}" answers the wrong question (shown after "${stored[i - 1]?.content}")`);
    }
    if (m.status !== "sent") problems.push(`message ${i} ended as "${m.status}"`);
  });
  if (sent[0] && users[0]?.id !== sent[0].id) problems.push(`the message answered first is not the first one shown`);

  // Each reply saw exactly what was shown before it: never a question still waiting.
  histories.forEach((history, k) => {
    const shownBefore = stored.slice(0, 2 * k + 1).map((m) => `${m.role}:${m.content}`);
    if (history.join(" | ") !== shownBefore.join(" | ")) problems.push(`reply ${k} saw [${history.join(" | ")}]`);
  });
  return problems;
}

describe.each<Latency>(["none", "database"])("parallel sends to one chat, repository latency: %s (AICHAT-191)", (latency) => {
  it(`${N} sends at once: each saved and answered once, in the order shown (${RUNS} runs)`, async () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const problems = problemsIn(await sendInParallel(latency, seed));
      for (const server of servers.splice(0)) server.close();
      if (problems.length > 0) failures.push(`seed ${seed}: ${problems.slice(0, 3).join("; ")}`);
    }
    expect(failures, `${failures.length}/${RUNS} runs inconsistent`).toEqual([]);
  });

  it(`two chats at once run in parallel, each in its own order (${RUNS} runs)`, async () => {
    for (let seed = 1; seed <= RUNS; seed += 1) {
      // Every first reply waits until both chats have one running: if the chats shared one
      // queue, the second would never start and the wait would time out.
      const running = new Set<string>();
      const { bus, store, send, createChat } = await setup(latency, seed, async (firstTurn) => {
        running.add(firstTurn.split(":")[1]?.slice(0, 1) ?? "");
        await until(() => running.size === 2, `both chats running (seed ${seed})`, 1000);
      });
      const [chatA, chatB] = [await createChat(), await createChat()];
      let done = 0;
      bus.subscribe(chatA, (e) => (done += e.type === "done" ? 1 : 0));
      bus.subscribe(chatB, (e) => (done += e.type === "done" ? 1 : 0));

      await Promise.all(
        ["a0", "b0", "a1", "b1"].map((content) => send(content.startsWith("a") ? chatA : chatB, content).expect(201)),
      );
      await until(() => done === 4, `4 replies (seed ${seed})`);

      // a0 and a1 were sent at the same moment, so either may come first; each reply must
      // follow its own question and nothing from the other chat may appear.
      for (const [chatId, questions] of [[chatA, ["a0", "a1"]], [chatB, ["b0", "b1"]]] as const) {
        const contents = (await store.findByChatOrdered(chatId)).map((m) => m.content);
        const asked = contents.filter((_, i) => i % 2 === 0);
        expect([...asked].sort(), `seed ${seed}`).toEqual(questions);
        expect(contents, `seed ${seed}`).toEqual(asked.flatMap((q) => [q, `reply to ${q}`]));
      }
      for (const server of servers.splice(0)) server.close();
    }
  });
});
