/**
 * AICHAT-192: retry, edit and cancel while a reply is streaming. Real app, queue and processor;
 * the LLM is scripted and every reply waits until the test releases it, so the test decides
 * when a turn ends. Races that depend on timing are run 50 times with a seeded offset between
 * the two requests; each run must end in one of the allowed outcomes, and across the runs both
 * outcomes must happen, which shows the race window was really hit.
 */
import { afterEach, describe, expect, it } from "vitest";
import { ProviderError } from "../features/llm-adapters/index.js";
import type { MessagesRepository } from "../features/messages/index.js";
import { ScriptedProvider } from "../test-utils/fake-provider-registry.js";
import type { FakeMessagesRepository } from "../test-utils/fake-messages-repository.js";
import { startRaceApp, until, type Latency, type RaceApp } from "../test-utils/race-harness.js";
import { sleep } from "../test-utils/with-latency.js";

const RUNS = 50;

/** A scripted LLM: each call records the history it was given and waits until released. The
 * calls listed in `fail` throw a provider error instead (a failed reply, ready to retry). */
function heldLlm(fail: number[] = []) {
  const calls: Array<{ turns: string[]; release: () => void }> = [];
  const provider = new ScriptedProvider(async function* (context) {
    const turns = context.messages.filter((m) => m.role !== "system").map((m) => `${m.role}:${String(m.content)}`);
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    const index = calls.push({ turns, release }) - 1;
    if (fail.includes(index)) throw new ProviderError("anthropic", "provider down", { retryable: true });
    await released;
    yield `reply to ${turns.at(-1)?.split(":").slice(1).join(":")}`;
  });
  /** Releases call `index` as soon as it starts. */
  const releaseWhenCalled = async (index: number) => {
    await until(() => calls.length > index, `LLM call ${index}`);
    calls[index]?.release();
  };
  return { provider, calls, releaseWhenCalled };
}

const contents = async (app: RaceApp, chatId: string) => (await app.store.findByChatOrdered(chatId)).map((m) => m.content);
const statuses = async (app: RaceApp, chatId: string) => (await app.store.findByChatOrdered(chatId)).map((m) => m.status);
const codeOf = (res: { body: unknown }) => (res.body as { error?: { code?: string } }).error?.code;
const doneCount = (events: ReturnType<RaceApp["events"]>) => events.filter((e) => e.type === "done" || e.type === "error").length;

/** A chat whose first reply failed: [q0, r0 (failed)]. */
async function chatWithFailedReply(app: RaceApp) {
  const chatId = await app.createChat();
  const events = app.events(chatId);
  await app.send(chatId, "q0").expect(201);
  await until(() => doneCount(events) === 1, "the first reply to fail");
  const failed = (await app.store.findByChatOrdered(chatId))[1];
  if (failed?.status !== "failed") throw new Error("setup: the first reply did not fail");
  return { chatId, events, failedId: failed.id };
}

let open: RaceApp | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

describe.each<Latency>(["none", "database"])("retry, edit and cancel during a reply, repository latency: %s (AICHAT-192)", (latency) => {
  it("S3: a retry while another reply streams is queued, runs after it, and is built from what is shown before it", async () => {
    const llm = heldLlm([0]);
    const app = (open = await startRaceApp({ latency, seed: 1, provider: llm.provider }));
    const { chatId, events, failedId } = await chatWithFailedReply(app);

    await app.send(chatId, "q1").expect(201); // its reply (call 1) is now streaming and held
    await until(() => llm.calls.length === 2, "the reply to q1 to start");
    const retry = await app.as("ana").post(`/chats/${chatId}/messages/${failedId}/retry`).expect(202);
    expect((retry.body as { message: { status: string } }).message.status).toBe("queued");
    await sleep(5);
    expect(llm.calls).toHaveLength(2); // the retry waits for the running reply

    llm.calls[1]?.release();
    await llm.releaseWhenCalled(2);
    await until(() => doneCount(events) === 3, "both replies");

    // The failed reply was reused in place: no new message, and it answers q0 only.
    expect(await contents(app, chatId)).toEqual(["q0", "reply to q0", "q1", "reply to q1"]);
    expect(await statuses(app, chatId)).toEqual(["sent", "sent", "sent", "sent"]);
    expect(llm.calls[2]?.turns).toEqual(["user:q0"]);
  });

  it(`S4: two retries of the same failed reply at once: one 202, one 409, one new answer (${RUNS} runs)`, async () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const llm = heldLlm([0]);
      const app = (open = await startRaceApp({ latency, seed, provider: llm.provider }));
      const { chatId, events, failedId } = await chatWithFailedReply(app);
      const retry = () => app.as("ana").post(`/chats/${chatId}/messages/${failedId}/retry`);

      const results = await Promise.all([retry(), retry()]);
      const codes = results.map((r) => r.status).sort();
      const rejected = results.find((r) => r.status === 409);
      await llm.releaseWhenCalled(1);
      await until(() => doneCount(events) === 2, `the retried reply (seed ${seed})`);
      await sleep(5); // a second, duplicated retry would start now

      const problems: string[] = [];
      if (codes.join() !== "202,409") problems.push(`retry statuses ${codes.join(",")}`);
      if (rejected && codeOf(rejected) !== "MESSAGE_NOT_RETRYABLE") problems.push(`409 code ${codeOf(rejected)}`);
      if (llm.calls.length !== 2) problems.push(`${llm.calls.length - 1} retries reached the LLM`);
      const final = await contents(app, chatId);
      if (final.join("|") !== "q0|reply to q0") problems.push(`final [${final.join(" | ")}]`);
      if (problems.length > 0) failures.push(`seed ${seed}: ${problems.join("; ")}`);
      await app.close();
      open = undefined;
    }
    expect(failures, `${failures.length}/${RUNS} runs inconsistent`).toEqual([]);
  });

  it(`S5: editing a queued message as it starts is applied before the start or rejected, never both (${RUNS} runs)`, async () => {
    const failures: string[] = [];
    const outcomes = new Set<number>();
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const llm = heldLlm();
      const app = (open = await startRaceApp({ latency, seed, provider: llm.provider }));
      const chatId = await app.createChat();
      const events = app.events(chatId);
      await app.send(chatId, "q0").expect(201);
      const q1 = (await app.send(chatId, "original").expect(201)).body as { message: { id: string } };
      await until(() => llm.calls.length === 1, "the first reply to start");

      // The first reply ends and the edit arrives within a few milliseconds of each other.
      const offset = seed % 6;
      const [edit] = await Promise.all([
        sleep(offset).then(() => app.as("ana").patch(`/chats/${chatId}/messages/${q1.message.id}`).send({ content: "edited" })),
        sleep(5 - (offset % 5)).then(() => llm.calls[0]?.release()),
      ]);
      await llm.releaseWhenCalled(1);
      await until(() => doneCount(events) === 2, `both replies (seed ${seed})`);
      outcomes.add(edit.status);

      const problems: string[] = [];
      const expected = edit.status === 200 ? "edited" : "original";
      if (![200, 409].includes(edit.status)) problems.push(`edit status ${edit.status}`);
      if (edit.status === 409 && codeOf(edit) !== "MESSAGE_NOT_EDITABLE") problems.push("wrong 409 code");
      const final = await contents(app, chatId);
      if (final.join("|") !== `q0|reply to q0|${expected}|reply to ${expected}`) problems.push(`edit ${edit.status}, final [${final.join(" | ")}]`);
      if (llm.calls[1]?.turns.at(-1) !== `user:${expected}`) problems.push(`edit ${edit.status}, the model got "${llm.calls[1]?.turns.at(-1)}"`);
      const ended = await statuses(app, chatId);
      if (ended.some((s) => s !== "sent")) problems.push(`statuses ${ended.join(",")}`);
      if (problems.length > 0) failures.push(`seed ${seed}: ${problems.join("; ")}`);
      await app.close();
      open = undefined;
    }
    expect(failures, `${failures.length}/${RUNS} runs inconsistent`).toEqual([]);
    expect([...outcomes].sort(), "both outcomes must happen, or the race was never hit").toEqual([200, 409]);
  });

  it("S5, worst case: the edit's write reaches the database only after the reply has started", async () => {
    const llm = heldLlm();
    // Every repository call that carries the edited text waits until the processor has taken
    // the message (it is no longer "queued"): the slowest database write possible.
    const holdEdits = (repo: MessagesRepository, store: FakeMessagesRepository): MessagesRepository =>
      new Proxy(repo, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver) as unknown;
          if (typeof value !== "function") return value;
          return async (...args: unknown[]) => {
            const [id, data] = args as [string, unknown];
            const carriesEdit = data === "edited" || (data as { content?: string } | undefined)?.content === "edited";
            if (carriesEdit) await until(() => store.all().some((m) => m.id === id && m.status !== "queued"), "the reply to start", 1000);
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        },
      });
    const app = (open = await startRaceApp({ latency, seed: 1, provider: llm.provider, intercept: holdEdits }));
    const chatId = await app.createChat();
    const events = app.events(chatId);
    await app.send(chatId, "q0").expect(201);
    const q1 = (await app.send(chatId, "original").expect(201)).body as { message: { id: string } };
    await until(() => llm.calls.length === 1, "the first reply to start");

    const edit = app.as("ana").patch(`/chats/${chatId}/messages/${q1.message.id}`).send({ content: "edited" });
    const editDone = edit.then((res) => res);
    await sleep(5); // the edit is now waiting on its write
    llm.calls[0]?.release();
    await llm.releaseWhenCalled(1);
    const res = await editDone;
    await until(() => doneCount(events) === 2, "both replies");

    // Whatever the answer, the stored text, the text the model answered and the status agree.
    const expected = res.status === 200 ? "edited" : "original";
    expect([200, 409]).toContain(res.status);
    expect(llm.calls[1]?.turns.at(-1)).toBe(`user:${expected}`);
    expect(await contents(app, chatId)).toEqual(["q0", "reply to q0", expected, `reply to ${expected}`]);
    expect(await statuses(app, chatId)).toEqual(["sent", "sent", "sent", "sent"]);
  });

  it(`S6: cancelling a queued message as it starts either removes it or is rejected, never both (${RUNS} runs)`, async () => {
    const failures: string[] = [];
    const outcomes = new Set<number>();
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const llm = heldLlm();
      const app = (open = await startRaceApp({ latency, seed, provider: llm.provider }));
      const chatId = await app.createChat();
      const events = app.events(chatId);
      await app.send(chatId, "q0").expect(201);
      const q1 = (await app.send(chatId, "q1").expect(201)).body as { message: { id: string } };
      await until(() => llm.calls.length === 1, "the first reply to start");

      const offset = seed % 6;
      const [cancel] = await Promise.all([
        sleep(offset).then(() => app.as("ana").delete(`/chats/${chatId}/messages/${q1.message.id}`)),
        sleep(5 - (offset % 5)).then(() => llm.calls[0]?.release()),
      ]);
      outcomes.add(cancel.status);
      if (cancel.status === 409) await llm.releaseWhenCalled(1);
      await until(() => doneCount(events) === (cancel.status === 204 ? 1 : 2), `the replies (seed ${seed})`);
      await sleep(5); // a cancelled message that still ran would reach the LLM now

      const problems: string[] = [];
      const final = await contents(app, chatId);
      if (cancel.status === 204) {
        if (final.join("|") !== "q0|reply to q0") problems.push(`cancelled, final [${final.join(" | ")}]`);
        if (llm.calls.length !== 1) problems.push("cancelled, but its reply was generated");
      } else if (cancel.status === 409) {
        if (codeOf(cancel) !== "MESSAGE_NOT_CANCELABLE") problems.push("wrong 409 code");
        if (final.join("|") !== "q0|reply to q0|q1|reply to q1") problems.push(`rejected, final [${final.join(" | ")}]`);
      } else {
        problems.push(`cancel status ${cancel.status}`);
      }
      if (problems.length > 0) failures.push(`seed ${seed}: ${problems.join("; ")}`);
      await app.close();
      open = undefined;
    }
    expect(failures, `${failures.length}/${RUNS} runs inconsistent`).toEqual([]);
    expect([...outcomes].sort(), "both outcomes must happen, or the race was never hit").toEqual([204, 409]);
  });
});
