import { vi } from "vitest";
import { QueueManager, type QueueProcessor } from "../features/queue/index.js";

/** A processor that records every call and never finishes, so the first message of a
 * chat stays "processing" and later ones stay queued. */
export function hangingProcessor() {
  return vi.fn<QueueProcessor>(() => new Promise<void>(() => {}));
}

/** A real `QueueManager` driven by a fake processor: no provider is called, and the test
 * decides what "processing" means. */
export function createFakeQueue(processor: QueueProcessor = hangingProcessor()): QueueManager {
  return new QueueManager(processor);
}
