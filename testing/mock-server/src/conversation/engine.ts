import { EventEmitter } from "node:events";
import type { MockContext } from "../registry.js";
import { answerStream, type AnswerScenario } from "./answer-text.js";
import type { SseEvent } from "./contract.js";
import { findChat, findMessage, nextId, nowIso, type StoredMessage } from "./records.js";

export interface QueueEntry {
  /** The user message to answer, or the failed assistant message to answer again. */
  messageId: string;
  kind: "send" | "retry";
  scenario: AnswerScenario;
}

interface Run {
  aborted: boolean;
  /** Ends the token stream of the answer when the run is stopped or reset. */
  abort: AbortController;
}

interface ChatRuntime {
  queue: QueueEntry[];
  run?: Run;
}

export const PROVIDER_ERROR_MESSAGE = "Mock provider error: the model is overloaded";

/**
 * Answers the messages of each chat one at a time, like the real queue: a message sent while
 * another one is streaming waits as `queued` and can still be edited or canceled. Tokens come
 * from `answerStream` (the LLM mock scenarios) and reach the stream subscribers of the chat.
 */
export class ConversationEngine {
  private readonly bus = new EventEmitter();
  private readonly chats = new Map<string, ChatRuntime>();

  constructor(private readonly ctx: MockContext) {
    this.bus.setMaxListeners(0);
  }

  subscribe(chatId: string, listener: (event: SseEvent) => void): () => void {
    this.bus.on(chatId, listener);
    return () => {
      this.bus.off(chatId, listener);
    };
  }

  publish(chatId: string, event: SseEvent): void {
    this.bus.emit(chatId, event);
  }

  /** True while an answer is streaming or waiting in this chat. */
  isBusy(chatId: string): boolean {
    const runtime = this.chats.get(chatId);
    return runtime !== undefined && (runtime.run !== undefined || runtime.queue.length > 0);
  }

  submit(chatId: string, entry: QueueEntry): void {
    this.runtimeOf(chatId).queue.push(entry);
    void this.drain(chatId);
  }

  /** True when the message was waiting in the queue (and so can be edited). */
  isQueued(chatId: string, messageId: string): boolean {
    return this.chats.get(chatId)?.queue.some((entry) => entry.messageId === messageId) ?? false;
  }

  /** Takes a waiting message out of the queue; false when it already started or is not there. */
  cancelQueued(chatId: string, messageId: string): boolean {
    const runtime = this.chats.get(chatId);
    if (!runtime || !this.isQueued(chatId, messageId)) return false;
    runtime.queue = runtime.queue.filter((entry) => entry.messageId !== messageId);
    return true;
  }

  /** Ends the streaming answer of a chat, keeping what was already written. */
  stop(chatId: string): boolean {
    const run = this.chats.get(chatId)?.run;
    if (!run) return false;
    run.aborted = true;
    run.abort.abort();
    return true;
  }

  /** Forgets a chat that was deleted. */
  drop(chatId: string): void {
    this.stop(chatId);
    this.chats.delete(chatId);
  }

  reset(): void {
    for (const runtime of this.chats.values()) {
      if (runtime.run) {
        runtime.run.aborted = true;
        runtime.run.abort.abort();
      }
    }
    this.chats.clear();
  }

  private runtimeOf(chatId: string): ChatRuntime {
    let runtime = this.chats.get(chatId);
    if (!runtime) {
      runtime = { queue: [] };
      this.chats.set(chatId, runtime);
    }
    return runtime;
  }

  private async drain(chatId: string): Promise<void> {
    const runtime = this.runtimeOf(chatId);
    if (runtime.run) return;
    const entry = runtime.queue.shift();
    if (!entry) return;
    const run: Run = { aborted: false, abort: new AbortController() };
    runtime.run = run;
    try {
      await this.answer(chatId, entry, run);
    } finally {
      // After a reset the runtime is no longer the one in the map: leave the new one alone.
      if (this.chats.get(chatId) === runtime) {
        runtime.run = undefined;
        void this.drain(chatId);
      }
    }
  }

  private async answer(chatId: string, entry: QueueEntry, run: Run): Promise<void> {
    const { ctx } = this;
    const chat = findChat(ctx, chatId);
    const trigger = findMessage(ctx, entry.messageId);
    if (!chat || !trigger) return;

    let reply: StoredMessage;
    if (entry.kind === "retry") {
      reply = trigger;
      Object.assign(reply, { content: "", reasoning: null, webFetches: undefined, status: "streaming", error: null });
    } else {
      trigger.status = "complete";
      reply = {
        id: nextId(ctx, "msg", ctx.store.data.messages.map((message) => message.id)),
        chatId,
        role: "assistant",
        content: "",
        status: "streaming",
        attachmentIds: [],
        createdAt: nowIso(),
        authorId: chat.ownerId,
        authorEmail: null,
      };
      ctx.store.data.messages.push(reply);
    }
    this.publish(chatId, { type: "started", messageId: reply.id });

    if (chat.reasoning && !run.aborted) {
      reply.reasoning = "";
      for (const token of ["Thinking about ", "the question, ", "then answering."]) {
        reply.reasoning += token;
        this.publish(chatId, { type: "reasoning", messageId: reply.id, token });
      }
    }
    if (chat.webFetch && !run.aborted) {
      const fetching = { id: "fetch_00001", url: "https://example.com/docs", status: "fetching" as const };
      this.publish(chatId, { type: "web_fetch", messageId: reply.id, fetch: fetching });
      const done = { ...fetching, status: "done" as const, title: "Example docs" };
      reply.webFetches = [done];
      this.publish(chatId, { type: "web_fetch", messageId: reply.id, fetch: done });
    }

    let index = -1;
    for await (const token of answerStream(entry.scenario, ctx, { signal: run.abort.signal })) {
      index += 1;
      if (run.aborted) break;
      reply.content += token;
      this.publish(chatId, { type: "token", messageId: reply.id, token });
      if (entry.scenario === "error" && index === 1) {
        reply.status = "failed";
        reply.error = PROVIDER_ERROR_MESSAGE;
        this.publish(chatId, { type: "error", messageId: reply.id, message: PROVIDER_ERROR_MESSAGE, retryable: true });
        return;
      }
    }

    // A reset replaced the records while this answer was running: nothing left to finish.
    if (findMessage(ctx, reply.id) !== reply) return;
    reply.status = "complete";
    chat.updatedAt = nowIso();
    this.publish(chatId, { type: "done", messageId: reply.id, ...(run.aborted ? { stopped: true } : {}) });
  }
}

const registry = new WeakMap<MockContext, ConversationEngine>();

/** The engine of one mock server; stops its answers on `/__admin/reset`. */
export function engineFor(ctx: MockContext): ConversationEngine {
  let engine = registry.get(ctx);
  if (!engine) {
    const created = new ConversationEngine(ctx);
    ctx.onReset(() => created.reset());
    registry.set(ctx, created);
    engine = created;
  }
  return engine;
}
