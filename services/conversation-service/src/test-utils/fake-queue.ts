import { vi } from "vitest";
import type { MessagesRepository } from "../features/messages/index.js";
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

/** Like `hangingProcessor`, but it first marks a sent message "sent", as the real processor
 * does when a reply starts: only the processor writes "sent" (AICHAT-191), so a fake that
 * skips it leaves the message "queued" and editable while it is being answered. */
export function takingProcessor(repo: Pick<MessagesRepository, "updateStatus">) {
  return vi.fn<QueueProcessor>(async (_chatId, entry) => {
    if (entry.kind !== "retry") await repo.updateStatus(entry.messageId, "sent");
    await new Promise<void>(() => {});
  });
}

/** A real `QueueManager` driven by a fake processor: no provider is called, and the test
 * decides what "processing" means. */
export function createFakeQueue(processor: QueueProcessor = hangingProcessor()): QueueManager {
  return new QueueManager(processor);
}
