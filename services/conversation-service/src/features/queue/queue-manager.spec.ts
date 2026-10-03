import { describe, expect, it, vi } from "vitest";
import { QueueManager } from "./queue-manager.js";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("QueueManager", () => {
  it("AC-56: submitting to an idle chat starts processing immediately", () => {
    const processor = vi.fn().mockResolvedValue(undefined);
    const manager = new QueueManager(processor);

    const result = manager.submit("chat-1", { messageId: "m1", content: "hi", attachmentIds: [] });

    expect(result).toBe("started");
  });

  it("AC-56: submitting while the chat is already processing queues the message", async () => {
    const first = deferred();
    const processor = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const manager = new QueueManager(processor);

    manager.submit("chat-1", { messageId: "m1", content: "hi", attachmentIds: [] });
    const secondResult = manager.submit("chat-1", { messageId: "m2", content: "hi", attachmentIds: [] });

    expect(secondResult).toBe("queued");
    first.resolve();
  });

  it("AC-59: processes queued messages one at a time, in order", async () => {
    const order: string[] = [];
    const gate = deferred();
    const processor = vi.fn().mockImplementation(async (_chatId, entry) => {
      if (entry.messageId === "m1") await gate.promise;
      order.push(entry.messageId);
    });
    const manager = new QueueManager(processor);

    manager.submit("chat-1", { messageId: "m1", content: "hi", attachmentIds: [] });
    manager.submit("chat-1", { messageId: "m2", content: "hi", attachmentIds: [] });
    manager.submit("chat-1", { messageId: "m3", content: "hi", attachmentIds: [] });

    gate.resolve();
    // let the microtask queue drain the whole chain
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(order).toEqual(["m1", "m2", "m3"]);
  });

  it("AC-60/61: two chats process concurrently and independently", async () => {
    const started: string[] = [];
    const gates = { "chat-a": deferred(), "chat-b": deferred() } as Record<string, ReturnType<typeof deferred>>;
    const processor = vi.fn().mockImplementation(async (chatId: string) => {
      started.push(chatId);
      await gates[chatId]?.promise;
    });
    const manager = new QueueManager(processor);

    manager.submit("chat-a", { messageId: "a1", content: "hi", attachmentIds: [] });
    manager.submit("chat-b", { messageId: "b1", content: "hi", attachmentIds: [] });

    await new Promise((r) => setTimeout(r, 0));
    expect(started).toContain("chat-a");
    expect(started).toContain("chat-b");

    gates["chat-a"]?.resolve();
    gates["chat-b"]?.resolve();
  });

  it("AC-74: a processor failure does not block the rest of the queue", async () => {
    const order: string[] = [];
    const processor = vi.fn().mockImplementation(async (_chatId, entry) => {
      if (entry.messageId === "m1") throw new Error("provider exploded");
      order.push(entry.messageId);
    });
    const onError = vi.fn();
    const manager = new QueueManager(processor, onError);

    manager.submit("chat-1", { messageId: "m1", content: "hi", attachmentIds: [] });
    manager.submit("chat-1", { messageId: "m2", content: "hi", attachmentIds: [] });

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(onError).toHaveBeenCalledWith("chat-1", expect.objectContaining({ messageId: "m1" }), expect.any(Error));
    expect(order).toEqual(["m2"]);
  });

  it("AC-58: editQueued/cancelQueued delegate to the chat's queue", () => {
    const manager = new QueueManager(vi.fn().mockReturnValue(new Promise(() => {})));
    manager.submit("chat-1", { messageId: "m1", content: "hi", attachmentIds: [] });
    manager.submit("chat-1", { messageId: "m2", content: "original", attachmentIds: [] });

    expect(manager.editQueued("chat-1", "m2", "edited")).toBe(true);
    expect(manager.cancelQueued("chat-1", "m2")).toBe(true);
  });

  it("AC-74: uses a silent no-op default when no onProcessorError callback is given", async () => {
    const processor = vi.fn().mockRejectedValue(new Error("boom"));
    const manager = new QueueManager(processor);

    manager.submit("chat-1", { messageId: "m1", content: "hi", attachmentIds: [] });

    await new Promise((r) => setTimeout(r, 0));
    // No assertion needed beyond "this did not throw/reject the test run".
  });

  it("AC-54: stop delegates to the chat's active queue entry", () => {
    const manager = new QueueManager(vi.fn().mockReturnValue(new Promise(() => {})));
    manager.submit("chat-1", { messageId: "m1", content: "hi", attachmentIds: [] });

    expect(manager.stop("chat-1")).toBe(true);
  });
});
