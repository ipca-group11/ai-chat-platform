import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type ApiError } from "../../../shared/api-client";
import { queryKeys } from "../../../shared/query-keys";
import type { Chat, ChatMember } from "../../../shared/types";

/** Owner first, then invited members. Visible to every member of the chat. */
export function useChatMembers(chatId: string, enabled = true): UseQueryResult<ChatMember[], ApiError> {
  return useQuery({
    queryKey: queryKeys.members(chatId),
    queryFn: () => apiClient.get<ChatMember[]>(`/chats/${chatId}/members`),
    enabled,
  });
}

/** Owner-only: gives the user with this email access to the chat right away. */
export function useAddChatMember(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation<ChatMember, ApiError, string>({
    mutationFn: (email) => apiClient.post<ChatMember>(`/chats/${chatId}/members`, { email }),
    onSuccess: (member) => {
      queryClient.setQueryData<ChatMember[]>(queryKeys.members(chatId), (existing) =>
        existing ? [...existing, member] : existing
      );
    },
  });
}

/** Owner-only: revokes a member's access. */
export function useRemoveChatMember(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (email) => apiClient.delete<void>(`/chats/${chatId}/members/${encodeURIComponent(email)}`),
    onSuccess: (_data, email) => {
      queryClient.setQueryData<ChatMember[]>(queryKeys.members(chatId), (existing) =>
        existing?.filter((m) => m.email !== email)
      );
    },
  });
}

/** A member leaves a chat that was shared with them. */
export function useLeaveChat(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => apiClient.delete<void>(`/chats/${chatId}/membership`),
    onSuccess: () => {
      queryClient.setQueryData<Chat[]>(queryKeys.chats(), (existing) => existing?.filter((c) => c.id !== chatId));
      queryClient.removeQueries({ queryKey: queryKeys.chat(chatId) });
      queryClient.removeQueries({ queryKey: queryKeys.messages(chatId) });
      queryClient.removeQueries({ queryKey: queryKeys.members(chatId) });
    },
  });
}
