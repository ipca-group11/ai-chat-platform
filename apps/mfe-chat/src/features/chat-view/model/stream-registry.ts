import type { QueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../shared/api-client";
import { queryKeys } from "../../../shared/query-keys";
import { subscribeToChatStream, type ChatStream } from "../../../shared/sse";
import type { Message } from "../../../shared/types";

/** How long to wait before opening a new stream once the browser has given up reconnecting. */
export const RECONNECT_DELAY_MS = 3000;

interface StreamEntry {
  /** Set right after the entry is registered (and replaced when a new stream is opened). */
  stream?: ChatStream;
  /** A transport error happened and the next `open` has not recovered from it yet. */
  dropped: boolean;
  retryTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Module-level (not component-level) registry of open per-chat SSE streams.
 *
 * This is what makes AC-60/AC-61 possible: a chat's stream is opened once and
 * lives here independent of whether that chat's `ChatView` is currently
 * mounted, so switching to another chat (unmounting this one) never closes
 * or interrupts it. React Query's cache is likewise app-global, so token
 * updates applied here are visible whenever the chat is reopened.
 *
 * AICHAT-167/168: events published while the connection is down are lost (the server keeps no
 * replay buffer), so the open that follows a drop refetches the chat's messages. Until then the
 * chat is marked as reconnecting, which the chat view shows.
 */
const activeStreams = new Map<string, StreamEntry>();

const reconnectingChats = new Set<string>();
const reconnectingListeners = new Set<() => void>();

function setReconnecting(chatId: string, value: boolean): void {
  if (reconnectingChats.has(chatId) === value) return;
  if (value) reconnectingChats.add(chatId);
  else reconnectingChats.delete(chatId);
  reconnectingListeners.forEach((listener) => listener());
}

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

/**
 * The server list wins, except for a reply it still reports as `streaming`: the processor saves the
 * text only when the reply ends, so the server has less than what is already shown. That reply keeps
 * the shown text; the `done` that ends it refetches the complete, saved text.
 */
function mergeAfterReconnect(shown: Message[], server: Message[]): Message[] {
  return server.map((message) => {
    const local = shown.find((m) => m.id === message.id);
    if (message.status !== "streaming" || !local || local.content.length <= message.content.length) return message;
    return { ...message, content: local.content, reasoning: local.reasoning ?? message.reasoning, webFetches: local.webFetches ?? message.webFetches };
  });
}

async function resyncMessages(chatId: string, queryClient: QueryClient): Promise<void> {
  try {
    // Same request as `fetchMessages` in api/messages.ts (which imports this module).
    const server = await apiClient.get<Message[]>(`/chats/${chatId}/messages`);
    queryClient.setQueryData<Message[]>(queryKeys.messages(chatId), (shown = []) => mergeAfterReconnect(shown, server));
  } catch {
    // Keep what is shown; the next `done` or `error` event refetches again.
  }
}

function connect(chatId: string, queryClient: QueryClient, entry: StreamEntry): ChatStream {
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

  return subscribeToChatStream(chatId, {
    // AICHAT-168: the first open is normal; an open after a drop recovers what was missed.
    onOpen: () => {
      if (!entry.dropped) return;
      entry.dropped = false;
      setReconnecting(chatId, false);
      void resyncMessages(chatId, queryClient);
    },
    // AICHAT-168: the browser retries by itself; if it has given up, open a new stream later.
    onConnectionError: (_event, { willReconnect }) => {
      if (activeStreams.get(chatId) !== entry) return;
      entry.dropped = true;
      setReconnecting(chatId, true);
      if (willReconnect || entry.retryTimer) return;
      entry.stream?.close();
      entry.retryTimer = setTimeout(() => {
        entry.retryTimer = undefined;
        if (activeStreams.get(chatId) === entry) entry.stream = connect(chatId, queryClient, entry);
      }, RECONNECT_DELAY_MS);
    },
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
    // AICHAT-202: a stopped reply says so right away; the refetch below reads the same flag back.
    onDone: ({ messageId, stopped }) => {
      upsertMessage(
        queryClient,
        chatId,
        messageId,
        (m) => ({ ...m, status: "sent", stopped: stopped === true }),
        () => assistantMessage(messageId, { status: "sent", stopped: stopped === true })
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
}

/** AC-60: opens (or reuses) an independent stream subscription for one chat. */
export function ensureChatStream(chatId: string, queryClient: QueryClient): void {
  if (activeStreams.has(chatId)) return;

  const entry: StreamEntry = { dropped: false };
  activeStreams.set(chatId, entry);
  entry.stream = connect(chatId, queryClient, entry);
}

export function isChatStreaming(chatId: string): boolean {
  return activeStreams.has(chatId);
}

/** AICHAT-168: the chat's stream dropped and has not reconnected yet. */
export function isChatReconnecting(chatId: string): boolean {
  return reconnectingChats.has(chatId);
}

/** Notifies when any chat starts or stops reconnecting (for `useSyncExternalStore`). */
export function subscribeToReconnecting(listener: () => void): () => void {
  reconnectingListeners.add(listener);
  return () => reconnectingListeners.delete(listener);
}

export function closeChatStream(chatId: string): void {
  const entry = activeStreams.get(chatId);
  if (entry?.retryTimer) clearTimeout(entry.retryTimer);
  entry?.stream?.close();
  activeStreams.delete(chatId);
  setReconnecting(chatId, false);
}

/** Test-only: clears every open stream between test cases. */
export function __resetStreamRegistryForTests(): void {
  [...activeStreams.keys()].forEach(closeChatStream);
}
