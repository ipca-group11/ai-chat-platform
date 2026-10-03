import { describe, expect, it } from "vitest";
import { ChatQueue } from "./chat-queue.js";

function entry(messageId: string, content = "hi"): { messageId: string; content: string; attachmentIds: string[] } {
  return { messageId, content, attachmentIds: [] };
}

describe("ChatQueue", () => {
  it("AC-56: entries added while idle can be started immediately", () => {
    const queue = new ChatQueue();
    queue.enqueue(entry("m1"));
    const started = queue.startNext();
    expect(started?.entry.messageId).toBe("m1");
    expect(queue.isProcessing).toBe(true);
  });

  it("AC-56/59: a second entry added while processing stays queued until the first finishes", () => {
    const queue = new ChatQueue();
    queue.enqueue(entry("m1"));
    queue.startNext();
    queue.enqueue(entry("m2"));

    expect(queue.startNext()).toBeNull();
    expect(queue.listQueued().map((e) => e.messageId)).toEqual(["m2"]);

    queue.finishActive();
    const nextStarted = queue.startNext();
    expect(nextStarted?.entry.messageId).toBe("m2");
  });

  it("AC-59: processes queued messages one at a time, in FIFO order", () => {
    const queue = new ChatQueue();
    queue.enqueue(entry("m1"));
    queue.startNext();
    queue.enqueue(entry("m2"));
    queue.enqueue(entry("m3"));
    queue.finishActive();

    expect(queue.startNext()?.entry.messageId).toBe("m2");
    queue.finishActive();
    expect(queue.startNext()?.entry.messageId).toBe("m3");
  });

  it("AC-58: a queued message can be edited before processing starts", () => {
    const queue = new ChatQueue();
    queue.enqueue(entry("m1"));
    queue.startNext();
    queue.enqueue(entry("m2", "original"));

    expect(queue.editQueued("m2", "edited")).toBe(true);
    expect(queue.listQueued()[0]?.content).toBe("edited");
  });

  it("AC-58: editing an already-active message is rejected", () => {
    const queue = new ChatQueue();
    queue.enqueue(entry("m1", "original"));
    queue.startNext();

    expect(queue.editQueued("m1", "edited")).toBe(false);
  });

  it("AC-58: a queued message can be canceled before processing starts", () => {
    const queue = new ChatQueue();
    queue.enqueue(entry("m1"));
    queue.startNext();
    queue.enqueue(entry("m2"));

    expect(queue.cancelQueued("m2")).toBe(true);
    expect(queue.listQueued()).toHaveLength(0);
  });

  it("AC-58: canceling an already-active message is rejected", () => {
    const queue = new ChatQueue();
    queue.enqueue(entry("m1"));
    queue.startNext();

    expect(queue.cancelQueued("m1")).toBe(false);
  });

  it("AC-54: stopActive aborts the active entry's signal", () => {
    const queue = new ChatQueue();
    queue.enqueue(entry("m1"));
    const started = queue.startNext();

    expect(queue.stopActive()).toBe(true);
    expect(started?.signal.aborted).toBe(true);
  });

  it("AC-54: stopActive is a no-op when nothing is processing", () => {
    const queue = new ChatQueue();
    expect(queue.stopActive()).toBe(false);
  });

  it("AC-59: activeEntry exposes the currently processing entry", () => {
    const queue = new ChatQueue();
    expect(queue.activeEntry).toBeNull();

    queue.enqueue(entry("m1"));
    queue.startNext();

    expect(queue.activeEntry?.messageId).toBe("m1");
  });
});
