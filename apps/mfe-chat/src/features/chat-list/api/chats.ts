import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../../shared/api-client";
import { queryKeys } from "../../../shared/query-keys";
import type { Chat, Provider } from "../../../shared/types";

/** AC-42 (list), AC-47 (server scopes to owner; this hook just renders what it gets back). */
export function useChats(): UseQueryResult<Chat[], ApiError> {
  return useQuery({
    queryKey: queryKeys.chats(),
    queryFn: fetchChats,
  });
}

/** AC-42 (open), AC-43 (restores on reload/relogin via refetch-on-mount), AC-46 (403/404 surfaced). */
export function useChat(chatId: string | undefined): UseQueryResult<Chat, ApiError> {
  return useQuery({
    queryKey: queryKeys.chat(chatId ?? ""),
    queryFn: () => fetchChat(chatId ?? ""),
    enabled: Boolean(chatId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return false;
      return failureCount < 2;
    },
  });
}

export interface CreateChatInput {
  title: string;
  provider: Provider;
  model: string;
  reasoning?: boolean;
  webFetch?: boolean;
}

// Requests to conversation-service, one function per route; the hooks below add caching.
// The pact tests (`chats.pact.spec.ts`) call these directly.
export const fetchChats = () => apiClient.get<Chat[]>("/chats");
export const fetchChat = (chatId: string) => apiClient.get<Chat>(`/chats/${chatId}`);
export const createChat = (input: CreateChatInput) => apiClient.post<Chat>("/chats", input);
export const updateChat = ({ chatId, ...patch }: UpdateChatInput) => apiClient.patch<Chat>(`/chats/${chatId}`, patch);
export const deleteChat = (chatId: string) => apiClient.delete<void>(`/chats/${chatId}`);

/** AC-42 (create), AC-48/AC-49 (provider+model chosen and persisted at creation). */
export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createChat,
    onSuccess: (chat) => {
      queryClient.setQueryData<Chat[]>(queryKeys.chats(), (existing) => [chat, ...(existing ?? [])]);
    },
  });
}

export interface UpdateChatInput {
  chatId: string;
  title?: string;
  provider?: Provider;
  model?: string;
  reasoning?: boolean;
  webFetch?: boolean;
}

/** AC-42 (rename), AC-48/AC-49 (provider+model edit persisted). */
export function useUpdateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateChat,
    onSuccess: (chat) => {
      queryClient.setQueryData(queryKeys.chat(chat.id), chat);
      queryClient.setQueryData<Chat[]>(queryKeys.chats(), (existing) =>
        existing?.map((c) => (c.id === chat.id ? chat : c))
      );
    },
  });
}

/** AC-42 (delete), AC-44 (removed chat/messages no longer appear or load). */
export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteChat,
    onSuccess: (_data, chatId) => {
      queryClient.setQueryData<Chat[]>(queryKeys.chats(), (existing) => existing?.filter((c) => c.id !== chatId));
      queryClient.removeQueries({ queryKey: queryKeys.chat(chatId) });
      queryClient.removeQueries({ queryKey: queryKeys.messages(chatId) });
    },
  });
}
