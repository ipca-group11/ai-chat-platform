export interface QueueEntry {
  messageId: string;
  content: string;
  attachmentIds: string[];
  /** Per-request LLM provider API key forwarded from the browser (ARCHITECTURE.md §6),
   * carried through the queue only transiently — never persisted. */
  apiKey?: string;
  /** `"send"` (default) promotes `messageId` (a user message) and creates a new
   * assistant reply; `"retry"` reprocesses `messageId` (a previously failed assistant
   * message) in place (AC-73). */
  kind?: "send" | "retry";
}

/**
 * A single chat's FIFO message queue (ARCHITECTURE.md §5). One instance per chatId,
 * process-local/in-memory (accepted for this scope). Queued-but-not-started entries can
 * be edited/canceled in place (AC-58); once an entry becomes "active" it can no longer
 * be mutated, only stopped/aborted by the caller.
 */
export class ChatQueue {
  private readonly entries: QueueEntry[] = [];
  private active: QueueEntry | null = null;
  private abortController: AbortController | null = null;

  get isProcessing(): boolean {
    return this.active !== null;
  }

  get activeEntry(): QueueEntry | null {
    return this.active;
  }

  /** Snapshot of queued (not-yet-started) entries, in FIFO order (AC-56/57). */
  listQueued(): QueueEntry[] {
    return [...this.entries];
  }

  enqueue(entry: QueueEntry): void {
    this.entries.push(entry);
  }

  /** Pops the next queued entry and marks it active (AC-59: processed one at a time, in
   * order). Returns `null` if the queue is empty or already processing. */
  startNext(): { entry: QueueEntry; signal: AbortSignal } | null {
    if (this.active) return null;
    const next = this.entries.shift();
    if (!next) return null;
    this.active = next;
    this.abortController = new AbortController();
    return { entry: next, signal: this.abortController.signal };
  }

  /** Marks the current active entry as finished (success, failure, or stop), freeing the
   * queue to start the next entry. */
  finishActive(): void {
    this.active = null;
    this.abortController = null;
  }

  /** Aborts the in-flight provider call for the active entry, if any (AC-54: stop a
   * response mid-stream). */
  stopActive(): boolean {
    if (!this.abortController) return false;
    this.abortController.abort();
    return true;
  }

  /** Edits a queued (not yet started) message's content (AC-58). Returns `false` if the
   * message is not found in the queued (non-active) portion. */
  editQueued(messageId: string, content: string): boolean {
    const entry = this.entries.find((e) => e.messageId === messageId);
    if (!entry) return false;
    entry.content = content;
    return true;
  }

  /** Cancels/removes a queued (not yet started) message (AC-58). Returns `false` if the
   * message is not found in the queued (non-active) portion (e.g. already active). */
  cancelQueued(messageId: string): boolean {
    const index = this.entries.findIndex((e) => e.messageId === messageId);
    if (index === -1) return false;
    this.entries.splice(index, 1);
    return true;
  }
}
