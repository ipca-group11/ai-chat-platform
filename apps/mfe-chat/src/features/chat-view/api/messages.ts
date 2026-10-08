import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type ApiError } from "../../../shared/api-client";
import { queryKeys } from "../../../shared/query-keys";
import type { Message, Provider } from "../../../shared/types";
import { ensureChatStream } from "../model/stream-registry";

/**
 * AC-53: the full conversation history is sent to the LLM as context on every
 * request. That concatenation happens server-side in `conversation-service`
 * (it owns the history); this hook is what supplies that same history to the
 * chat view for rendering, and its query key is what `conversation-service`'s
 * response is expected to keep in sync with.
 */
export function useMessages(chatId: string | undefined): UseQueryResult<Message[], ApiError> {
  return useQuery({
    queryKey: queryKeys.messages(chatId ?? ""),
    queryFn: () => apiClient.get<Message[]>(`/chats/${chatId}/messages`),
    enabled: Boolean(chatId),
  });
}

export interface SendMessageInput {
  chatId: string;
  content: string;
  attachmentIds?: string[];
  userId: string;
  provider: Provider;
}

/** AC-51: persisted immediately and shown; also (re)opens this chat's stream (AC-60/AC-61). */
export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, content, attachmentIds, userId, provider }: SendMessageInput) =>
      apiClient.post<Message>(
        `/chats/${chatId}/messages`,
        { content, attachmentIds },
        { llmKey: { userId, provider } }
      ),
    onSuccess: (message, { chatId }) => {
      // The stream's `message` event may have added it already.
      queryClient.setQueryData<Message[]>(queryKeys.messages(chatId), (existing = []) =>
        existing.some((m) => m.id === message.id) ? existing : [...existing, message]
      );
      ensureChatStream(chatId, queryClient);
    },
  });
}

/**
 * AC-54: stop a response mid-stream; the partial response is saved server-side and re-synced here.
 * conversation-service stops whatever reply is active in the chat (`POST /chats/:chatId/stop`), so
 * `messageId` only identifies the bubble the user clicked; it is not part of the request.
 */
export function useStopMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId }: { chatId: string; messageId: string }) =>
      apiClient.post<{ stopped: boolean }>(`/chats/${chatId}/stop`),
    onSuccess: (_data, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(chatId) });
    },
  });
}

export interface RetryMessageInput {
  chatId: string;
  messageId: string;
  /** Whose key to send: the retry calls the LLM again, just like a send. */
  userId: string;
  provider: Provider;
}

/** AC-73: retry a message that failed due to a provider error. */
export function useRetryMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, messageId, userId, provider }: RetryMessageInput) =>
      apiClient.post<Message>(`/chats/${chatId}/messages/${messageId}/retry`, undefined, { llmKey: { userId, provider } }),
    onSuccess: (message, { chatId }) => {
      queryClient.setQueryData<Message[]>(queryKeys.messages(chatId), (existing = []) =>
        existing.map((m) => (m.id === message.id ? message : m))
      );
      ensureChatStream(chatId, queryClient);
    },
  });
}

/** AC-58: edit a queued message before its processing starts. */
export function useEditQueuedMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, messageId, content }: { chatId: string; messageId: string; content: string }) =>
      apiClient.patch<Message>(`/chats/${chatId}/messages/${messageId}`, { content }),
    onSuccess: (message, { chatId }) => {
      queryClient.setQueryData<Message[]>(queryKeys.messages(chatId), (existing = []) =>
        existing.map((m) => (m.id === message.id ? message : m))
      );
    },
  });
}

/** AC-58: cancel a queued message before its processing starts. */
export function useCancelQueuedMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, messageId }: { chatId: string; messageId: string }) =>
      apiClient.delete<void>(`/chats/${chatId}/messages/${messageId}`),
    onSuccess: (_data, { chatId, messageId }) => {
      queryClient.setQueryData<Message[]>(queryKeys.messages(chatId), (existing = []) =>
        existing.filter((m) => m.id !== messageId)
      );
    },
  });
}
