import type { ChatsService } from "../chats/index.js";
import { ProviderError, type ProviderRegistry, type LlmMessage } from "../llm-adapters/index.js";
import type { QueueEntry, QueueProcessor } from "../queue/index.js";
import type { ChatEventBus } from "../streaming/index.js";
import type { WebFetchDto } from "../../shared/contracts/chat.js";
import { turnClock } from "../../shared/turn-clock.js";
import type { MessageRecord, MessagesRepository } from "./service.js";

/** Converts persisted messages into the LLM adapter's context shape. Ignores
 * attachments by default; the attachments feature supplies a richer implementation
 * (extracted text / image bytes) wired in at `app.ts` (AC-69/70). */
export async function defaultBuildLlmMessages(messages: MessageRecord[]): Promise<LlmMessage[]> {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export interface CreateMessageProcessorDeps {
  messagesRepo: MessagesRepository;
  chatsService: ChatsService;
  providerRegistry: ProviderRegistry;
  bus: ChatEventBus;
  buildLlmMessages?: (messages: MessageRecord[]) => Promise<LlmMessage[]>;
  /** Added as a system message before the history of every reply; none when unset. */
  systemPrompt?: string;
  /** Stamps `sentAt`; every reading is later than the previous one (AICHAT-191). */
  clock?: () => Date;
}

/**
 * Builds the `QueueProcessor` callback the `QueueManager` invokes for each queue entry
 * (BE-4). Handles both a fresh send (AC-51..53) and a retry of a failed message
 * (AC-73), streams tokens over the `ChatEventBus` (AC-52), saves partial content when
 * the signal is aborted (AC-54), and always resolves — never throws — so a provider
 * failure never blocks the rest of the FIFO queue (AC-72/74).
 */
export function createMessageProcessor(deps: CreateMessageProcessorDeps): QueueProcessor {
  const buildLlmMessages = deps.buildLlmMessages ?? defaultBuildLlmMessages;
  const clock = deps.clock ?? turnClock;

  return async function processQueueEntry(chatId: string, entry: QueueEntry, signal: AbortSignal): Promise<void> {
    const chat = await deps.chatsService.findById(chatId);
    if (!chat) return; // chat was deleted while queued; nothing left to do (AC-44).

    let assistantMessage: MessageRecord;
    if (entry.kind === "retry") {
      const existing = await deps.messagesRepo.findById(entry.messageId);
      if (!existing) return;
      assistantMessage = await deps.messagesRepo.updateContent(entry.messageId, {
        content: "",
        reasoning: null,
        webFetches: null,
        status: "streaming",
        error: null,
      });
    } else {
      // The question and its reply take their place in the conversation now, one after the
      // other, so a message written earlier but queued is listed after the replies before it.
      await deps.messagesRepo.updateStatus(entry.messageId, "sent", clock());
      assistantMessage = await deps.messagesRepo.create({
        chatId,
        ownerId: chat.ownerId,
        role: "assistant",
        content: "",
        status: "streaming",
        sentAt: clock(),
      });
    }

    deps.bus.publish(chatId, { type: "started", messageId: assistantMessage.id });

    const historyRows = (await deps.messagesRepo.findByChatOrdered(chatId)).filter(
      (m) => m.id !== assistantMessage.id && m.status !== "failed" && m.status !== "queued",
    );
    const history = await buildLlmMessages(historyRows);
    const llmMessages: LlmMessage[] = deps.systemPrompt ? [{ role: "system", content: deps.systemPrompt }, ...history] : history;

    const provider = deps.providerRegistry.get(chat.provider);
    let content = "";
    let reasoning = "";
    // Null rather than "" so replies without reasoning don't render an empty section.
    const webFetches = new Map<string, WebFetchDto>();
    // What gets saved with the reply. A fetch still in flight when the reply ends (stopped
    // or failed) never finished, so it isn't kept.
    const saved = () => {
      const finished = [...webFetches.values()].filter((f) => f.status !== "fetching");
      return { content, reasoning: reasoning || null, webFetches: finished.length > 0 ? finished : null };
    };

    try {
      for await (const chunk of provider.sendMessage(
        { messages: llmMessages, model: chat.model, apiKey: entry.apiKey, reasoning: chat.reasoning, webFetch: chat.webFetch },
        { signal },
      )) {
        if (typeof chunk === "string") {
          content += chunk;
          deps.bus.publish(chatId, { type: "token", messageId: assistantMessage.id, token: chunk });
        } else if (chunk.type === "web_fetch") {
          const { type: _type, ...fetch } = chunk;
          webFetches.set(fetch.id, fetch);
          deps.bus.publish(chatId, { type: "web_fetch", messageId: assistantMessage.id, fetch });
        } else if (chat.reasoning) {
          // Some models think even with reasoning off (e.g. gpt-oss at its lowest level);
          // that thinking stays hidden.
          reasoning += chunk.text;
          deps.bus.publish(chatId, { type: "reasoning", messageId: assistantMessage.id, token: chunk.text });
        }
      }
      await deps.messagesRepo.updateContent(assistantMessage.id, { ...saved(), status: "sent" });
      deps.bus.publish(chatId, { type: "done", messageId: assistantMessage.id });
    } catch (err) {
      if (isAbortError(err)) {
        // AC-54: partial response saved to history; AICHAT-202: marked as stopped so it still
        // reads as stopped after a reload.
        await deps.messagesRepo.updateContent(assistantMessage.id, { ...saved(), status: "sent", stopped: true });
        deps.bus.publish(chatId, { type: "done", messageId: assistantMessage.id, stopped: true });
        return;
      }

      const providerError =
        err instanceof ProviderError
          ? err
          : new ProviderError(chat.provider, "Unexpected provider error", { retryable: true, cause: err });

      // AC-72/74: caught, surfaced, saved as failed — never rethrown, so the queue
      // moves on to the next message.
      await deps.messagesRepo.updateContent(assistantMessage.id, {
        ...saved(),
        status: "failed",
        error: providerError.message,
      });
      deps.bus.publish(chatId, {
        type: "error",
        messageId: assistantMessage.id,
        message: providerError.message,
        retryable: providerError.retryable,
      });
    }
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}
