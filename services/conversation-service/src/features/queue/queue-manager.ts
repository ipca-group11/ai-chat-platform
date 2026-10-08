import { ChatQueue, type QueueEntry } from "./chat-queue.js";

export type { QueueEntry } from "./chat-queue.js";

export type QueueProcessor = (chatId: string, entry: QueueEntry, signal: AbortSignal) => Promise<void>;

export type SubmitResult = "started" | "queued";

/**
 * Owns one `ChatQueue` per chat (process-local, ARCHITECTURE.md §5) and drives the
 * FIFO processing loop: whenever a chat becomes idle, the next queued entry (if any) is
 * started automatically (AC-59), and failures never stop the loop (AC-74). Multiple
 * chats' queues run fully independently and concurrently (AC-60/61).
 */
export class QueueManager {
  private readonly queues = new Map<string, ChatQueue>();

  constructor(
    private readonly processor: QueueProcessor,
    private readonly onProcessorError: (chatId: string, entry: QueueEntry, error: unknown) => void = () => {},
  ) {}

  getQueue(chatId: string): ChatQueue {
    let queue = this.queues.get(chatId);
    if (!queue) {
      queue = new ChatQueue();
      this.queues.set(chatId, queue);
    }
    return queue;
  }

  /** Adds a message to the chat's queue and kicks off processing if the chat is idle
   * (AC-56: queued while waiting/streaming; started immediately otherwise). */
  submit(chatId: string, entry: QueueEntry): SubmitResult {
    const queue = this.getQueue(chatId);
    const wasIdle = !queue.isProcessing;
    queue.enqueue(entry);
    void this.pump(chatId);
    return wasIdle ? "started" : "queued";
  }

  /** Stops the currently streaming message for a chat, if any (AC-54). */
  stop(chatId: string): boolean {
    return this.getQueue(chatId).stopActive();
  }

  /** Stops every running reply that `userId` started, in any chat (AICHAT-203: logout).
   * Replies started by other members of a shared chat keep running. Returns how many stopped. */
  stopForUser(userId: string): number {
    let stopped = 0;
    for (const queue of this.queues.values()) {
      if (queue.activeEntry?.userId === userId && queue.stopActive()) stopped += 1;
    }
    return stopped;
  }

  editQueued(chatId: string, messageId: string, content: string): boolean {
    return this.getQueue(chatId).editQueued(messageId, content);
  }

  cancelQueued(chatId: string, messageId: string): boolean {
    return this.getQueue(chatId).cancelQueued(messageId);
  }

  private async pump(chatId: string): Promise<void> {
    const queue = this.getQueue(chatId);
    const started = queue.startNext();
    if (!started) return;

    try {
      await this.processor(chatId, started.entry, started.signal);
    } catch (error) {
      // The processor (messages feature) is expected to catch provider errors itself
      // and persist a "failed" status; this is a last-resort guard so an unexpected
      // throw still never blocks the rest of the queue (AC-74).
      this.onProcessorError(chatId, started.entry, error);
    } finally {
      queue.finishActive();
    }

    // Keep draining the FIFO queue in order (AC-59) until it's empty.
    void this.pump(chatId);
  }
}
