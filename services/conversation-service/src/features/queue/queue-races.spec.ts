/**
 * AICHAT-190: race cases for the per-chat queue. The FIFO order, two chats at once and a
 * failing processor are already covered one step at a time in `queue-manager.spec.ts`;
 * here the operations overlap. Every processor call returns a deferred promise, so the test
 * decides the exact moment each reply ends and the interleaving is the same on every run.
 */
import { describe, expect, it, vi } from "vitest";
import { ChatQueue, type QueueEntry } from "./chat-queue.js";
import { QueueManager, type QueueProcessor } from "./queue-manager.js";

function deferred() {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Call {
  chatId: string;
  entry: QueueEntry;
  signal: AbortSignal;
  finish: () => void;
  fail: (err: unknown) => void;
}

/** A processor that waits on every call until the test finishes or fails it. `onStart` runs
 * synchronously at the instant an entry becomes active, before the processor awaits anything. */
function controlledProcessor(onStart?: (chatId: string, entry: QueueEntry) => void) {
  const calls: Call[] = [];
  const fn = vi.fn<QueueProcessor>((chatId, entry, signal) => {
    onStart?.(chatId, entry);
    const d = deferred();
    calls.push({ chatId, entry, signal, finish: d.resolve, fail: d.reject });
    return d.promise;
  });
  const call = (messageId: string): Call => {
    const found = calls.find((c) => c.entry.messageId === messageId);
    if (!found) throw new Error(`${messageId} never started`);
    return found;
  };
  const started = () => calls.map((c) => c.entry.messageId);
  return { fn, call, started };
}

const entry = (messageId: string, content = "hi"): QueueEntry => ({ messageId, content, attachmentIds: [] });

/** Lets every pending promise callback run (the queue moves on in microtasks). */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("QueueManager races (AICHAT-190)", () => {
  it("keeps FIFO order when submit, edit and cancel interleave while a reply is active", async () => {
    const processor = controlledProcessor();
    const manager = new QueueManager(processor.fn);

    manager.submit("chat-1", entry("m1"));
    manager.submit("chat-1", entry("m2"));
    manager.submit("chat-1", entry("m3"));
    expect(manager.cancelQueued("chat-1", "m2")).toBe(true);
    manager.submit("chat-1", entry("m4"));
    expect(manager.editQueued("chat-1", "m3", "edited")).toBe(true);
    manager.submit("chat-1", entry("m5"));
    expect(manager.cancelQueued("chat-1", "m5")).toBe(true);

    processor.call("m1").finish();
    await flush();
    expect(processor.started()).toEqual(["m1", "m3"]);
    expect(processor.call("m3").entry.content).toBe("edited");

    processor.call("m3").finish();
    await flush();
    processor.call("m4").finish();
    await flush();

    // Each surviving entry ran once, in order; the cancelled ones never ran.
    expect(processor.started()).toEqual(["m1", "m3", "m4"]);
    expect(manager.getQueue("chat-1").isProcessing).toBe(false);
    expect(manager.getQueue("chat-1").listQueued()).toEqual([]);
  });

  it("a cancel or edit at the instant an entry becomes active returns false, and the entry runs unchanged", async () => {
    const attempts: boolean[] = [];
    const processor = controlledProcessor((chatId, started) => {
      if (started.messageId === "m2") {
        attempts.push(manager.cancelQueued(chatId, "m2"), manager.editQueued(chatId, "m2", "too late"));
      }
    });
    const manager = new QueueManager(processor.fn);
    manager.submit("chat-1", entry("m1"));
    manager.submit("chat-1", entry("m2", "original"));

    processor.call("m1").finish();
    await flush();

    expect(attempts).toEqual([false, false]);
    expect(processor.call("m2").entry.content).toBe("original");
    expect(manager.getQueue("chat-1").activeEntry?.messageId).toBe("m2");
  });

  it("a cancel in the same tick as the previous reply ends still wins: the entry never runs", async () => {
    const processor = controlledProcessor();
    const manager = new QueueManager(processor.fn);
    manager.submit("chat-1", entry("m1"));
    manager.submit("chat-1", entry("m2"));
    manager.submit("chat-1", entry("m3"));

    processor.call("m1").finish();
    // The queue only moves on in a later microtask, so m2 is still waiting here.
    expect(manager.cancelQueued("chat-1", "m2")).toBe(true);
    await flush();

    expect(processor.started()).toEqual(["m1", "m3"]);
  });

  it("there is no idle gap between two replies: a submit as one ends is queued behind the waiting ones", async () => {
    const processor = controlledProcessor();
    const manager = new QueueManager(processor.fn);
    manager.submit("chat-1", entry("m1"));
    manager.submit("chat-1", entry("m2"));

    processor.call("m1").finish();
    await flush();
    expect(manager.submit("chat-1", entry("m3"))).toBe("queued");
    expect(processor.started()).toEqual(["m1", "m2"]);
  });

  it("N submits in the same tick: one started, the rest queued, each runs exactly once in order", async () => {
    const order: string[] = [];
    const manager = new QueueManager(async (_chatId, e) => {
      await flush();
      order.push(e.messageId);
    });
    const ids = Array.from({ length: 20 }, (_, i) => `m${i}`);

    const results = ids.map((id) => manager.submit("chat-1", entry(id)));
    for (let i = 0; i < ids.length + 2; i += 1) await flush();

    expect(results).toEqual(["started", ...Array(19).fill("queued")]);
    expect(order).toEqual(ids);
  });

  it("stop aborts only the active reply; the next one starts with a fresh signal", async () => {
    const processor = controlledProcessor();
    const manager = new QueueManager(processor.fn);
    expect(manager.stop("chat-1")).toBe(false); // nothing to stop yet

    manager.submit("chat-1", entry("m1"));
    manager.submit("chat-1", entry("m2"));
    expect(manager.stop("chat-1")).toBe(true);

    expect(processor.call("m1").signal.aborted).toBe(true);
    expect(processor.started()).toEqual(["m1"]); // m2 is untouched, still waiting
    expect(manager.getQueue("chat-1").listQueued().map((e) => e.messageId)).toEqual(["m2"]);

    // The real processor returns once it is aborted; then the queue moves on.
    processor.call("m1").finish();
    await flush();
    expect(processor.call("m2").signal.aborted).toBe(false);
  });

  it("a stop that arrives after a reply ended reaches the reply active at that moment (the stop route names no message)", async () => {
    const processor = controlledProcessor();
    const manager = new QueueManager(processor.fn);
    manager.submit("chat-1", entry("m1"));
    manager.submit("chat-1", entry("m2"));

    processor.call("m1").finish();
    await flush();
    manager.stop("chat-1");

    expect(processor.call("m1").signal.aborted).toBe(false);
    expect(processor.call("m2").signal.aborted).toBe(true);
  });

  it("a processor that throws, rejects or resolves: every entry runs once and the chat ends idle (AC-74)", async () => {
    const onError = vi.fn();
    const processor = vi.fn<QueueProcessor>((_chatId, e) => {
      if (e.messageId === "m1") throw new Error("thrown before any await");
      if (e.messageId === "m2") return Promise.reject(new Error("rejected"));
      return Promise.resolve();
    });
    const manager = new QueueManager(processor, onError);

    for (const id of ["m1", "m2", "m3"]) manager.submit("chat-1", entry(id));
    for (let i = 0; i < 5; i += 1) await flush();

    expect(processor.mock.calls.map(([, e]) => e.messageId)).toEqual(["m1", "m2", "m3"]);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(manager.getQueue("chat-1").isProcessing).toBe(false);
    expect(manager.submit("chat-1", entry("m4"))).toBe("started");
  });

  it("an error callback that throws does not stall the queue either", async () => {
    const processor = vi.fn<QueueProcessor>((_chatId, e) =>
      e.messageId === "m1" ? Promise.reject(new Error("provider exploded")) : Promise.resolve(),
    );
    const manager = new QueueManager(processor, () => {
      throw new Error("the logger failed too");
    });

    manager.submit("chat-1", entry("m1"));
    manager.submit("chat-1", entry("m2"));
    for (let i = 0; i < 5; i += 1) await flush();

    expect(processor.mock.calls.map(([, e]) => e.messageId)).toEqual(["m1", "m2"]);
    expect(manager.getQueue("chat-1").isProcessing).toBe(false);
  });

  it("two chats: a reply that never ends in one chat does not delay the other, and stop stays in its chat", async () => {
    const processor = controlledProcessor();
    const manager = new QueueManager(processor.fn);
    manager.submit("chat-a", entry("a1"));
    manager.submit("chat-a", entry("a2"));
    manager.submit("chat-b", entry("b1"));
    manager.submit("chat-b", entry("b2"));

    manager.stop("chat-b");
    expect(processor.call("a1").signal.aborted).toBe(false);

    processor.call("b1").finish();
    await flush();
    processor.call("b2").finish();
    await flush();

    // chat-b drained while a1 is still running; a2 is still waiting for it.
    expect(processor.started()).toEqual(["a1", "b1", "b2"]);
    expect(manager.getQueue("chat-b").isProcessing).toBe(false);
    expect(manager.getQueue("chat-a").listQueued().map((e) => e.messageId)).toEqual(["a2"]);
  });
});

describe("ChatQueue races (AICHAT-190)", () => {
  it("startNext twice while an entry is active never activates a second one", () => {
    const queue = new ChatQueue();
    queue.enqueue(entry("m1"));
    queue.enqueue(entry("m2"));

    expect(queue.startNext()?.entry.messageId).toBe("m1");
    expect(queue.startNext()).toBeNull();
    expect(queue.activeEntry?.messageId).toBe("m1");
    expect(queue.listQueued().map((e) => e.messageId)).toEqual(["m2"]);
  });

  it("listQueued is a snapshot: changing the returned array does not change the queue", () => {
    const queue = new ChatQueue();
    queue.enqueue(entry("m1"));
    queue.listQueued().pop();
    expect(queue.listQueued().map((e) => e.messageId)).toEqual(["m1"]);
  });
});
