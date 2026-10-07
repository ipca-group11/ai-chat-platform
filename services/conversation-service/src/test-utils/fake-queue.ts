import { vi } from "vitest";
import { QueueManager, type QueueProcessor } from "../features/queue/index.js";

/** A processor that records every call and never finishes, so the first message of a
 * chat stays "processing" and later ones stay queued. */
export function hangingProcessor() {
  return vi.fn<QueueProcessor>(() => new Promise<void>(() => {}));
}

/** Like `hangingProcessor`, but it finishes when its reply is aborted, as the real processor
 * does (it saves the partial text and returns), so the queue frees the chat after a stop. */
export function stoppableProcessor() {
  return vi.fn<QueueProcessor>(
    (_chatId, _entry, signal) =>
      new Promise<void>((resolve) => {
        if (signal.aborted) resolve();
        else signal.addEventListener("abort", () => resolve(), { once: true });
      }),
  );
}

/** A real `QueueManager` driven by a fake processor: no provider is called, and the test
 * decides what "processing" means. */
export function createFakeQueue(processor: QueueProcessor = hangingProcessor()): QueueManager {
  return new QueueManager(processor);
}
