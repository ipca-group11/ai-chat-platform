import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/query-keys";
import { subscribeToChatStream, type ChatStream } from "../../../shared/sse";
import type { Message } from "../../../shared/types";

/**
 * Module-level (not component-level) registry of open per-chat SSE streams.
 *
 * This is what makes AC-60/AC-61 possible: a chat's stream is opened once and
 * lives here independent of whether that chat's `ChatView` is currently
 * mounted, so switching to another chat (unmounting this one) never closes
 * or interrupts it. React Query's cache is likewise app-global, so token
 * updates applied here are visible whenever the chat is reopened.
 */
const activeStreams = new Map<string, ChatStream>();

function upsertMessage(queryClient: QueryClient, chatId: string, messageId: string, patch: (m: Message) => Message, create: () => Message) {
  queryClient.setQueryData<Message[]>(queryKeys.messages(chatId), (existing = []) => {
    const idx = existing.findIndex((m) => m.id === messageId);
    if (idx === -1) return [...existing, create()];
    const updated = [...existing];
    const current = updated[idx];
    if (current) updated[idx] = patch(current);
    return updated;
  });
}

/** AC-60: opens (or reuses) an independent stream subscription for one chat. */
export function ensureChatStream(chatId: string, queryClient: QueryClient): void {
  if (activeStreams.has(chatId)) return;

  const assistantMessage = (messageId: string, patch: Partial<Message>): Message => ({
    id: messageId,
    chatId,
    role: "assistant",
    content: "",
    attachments: [],
    status: "streaming",
    createdAt: new Date().toISOString(),
    ...patch,
  });

  const stream = subscribeToChatStream(chatId, {
    // Messages posted by other members of a shared chat (our own are already in the
    // cache from the send response; upserting by id keeps this idempotent).
    onMessage: ({ message }) => {
      upsertMessage(queryClient, chatId, message.id, (m) => m, () => message);
    },
    // Show the assistant reply (in its "thinking" state) as soon as the server starts
    // on it, not only once the first token arrives — local models can take a while.
    onStarted: ({ messageId }) => {
      upsertMessage(
        queryClient,
        chatId,
        messageId,
        (m) => ({ ...m, content: "", reasoning: null, webFetches: [], status: "streaming", error: null }),
        () => assistantMessage(messageId, {})
      );
      // The user message moved from queued -> sent server-side.
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(chatId) });
    },
    // AC-52: render the LLM response token by token, incrementally.
    onToken: ({ messageId, token }) => {
      upsertMessage(
        queryClient,
        chatId,
        messageId,
        (m) => ({ ...m, content: m.content + token, status: "streaming" }),
        () => assistantMessage(messageId, { content: token })
      );
    },
    onReasoning: ({ messageId, token }) => {
      upsertMessage(
        queryClient,
        chatId,
        messageId,
        (m) => ({ ...m, reasoning: (m.reasoning ?? "") + token, status: "streaming" }),
        () => assistantMessage(messageId, { reasoning: token })
      );
    },
    onWebFetch: ({ messageId, fetch }) => {
      upsertMessage(
        queryClient,
        chatId,
        messageId,
        (m) => {
          const fetches = m.webFetches ?? [];
          const known = fetches.some((f) => f.id === fetch.id);
          return {
            ...m,
            webFetches: known ? fetches.map((f) => (f.id === fetch.id ? fetch : f)) : [...fetches, fetch],
            status: "streaming",
          };
        },
        () => assistantMessage(messageId, { webFetches: [fetch] })
      );
    },
    // AC-55: the completed response is saved server-side; mark it done locally and
    // refetch so the cache matches what was persisted.
    onDone: ({ messageId }) => {
      upsertMessage(
        queryClient,
        chatId,
        messageId,
        (m) => ({ ...m, status: "sent" }),
        () => assistantMessage(messageId, { status: "sent" })
      );
      // AC-59: the next queued message (if any) may now be picked up server-side;
      // refetch so its status (queued -> streaming) is reflected in the UI.
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(chatId) });
    },
    // AC-72/AC-74: provider errors are caught and surfaced without crashing the chat,
    // and without blocking the rest of the queue (server moves on; we just refetch).
    onError: ({ messageId, message }) => {
      upsertMessage(
        queryClient,
        chatId,
        messageId,
        (m) => ({ ...m, status: "failed", error: message }),
        () => assistantMessage(messageId, { status: "failed", error: message })
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(chatId) });
    },
  });

  activeStreams.set(chatId, stream);
}

export function isChatStreaming(chatId: string): boolean {
  return activeStreams.has(chatId);
}

export function closeChatStream(chatId: string): void {
  activeStreams.get(chatId)?.close();
  activeStreams.delete(chatId);
}

/** Test-only: clears every open stream between test cases. */
export function __resetStreamRegistryForTests(): void {
  activeStreams.forEach((s) => s.close());
  activeStreams.clear();
}
