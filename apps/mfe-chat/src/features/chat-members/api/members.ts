import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type ApiError } from "../../../shared/api-client";
import { queryKeys } from "../../../shared/query-keys";
import type { Chat, ChatMember } from "../../../shared/types";

// Requests to conversation-service, one function per route; the hooks below add caching.
// The pact tests (`members.pact.spec.ts`) call these directly.
export const fetchChatMembers = (chatId: string) => apiClient.get<ChatMember[]>(`/chats/${chatId}/members`);
export const addChatMember = (chatId: string, email: string) => apiClient.post<ChatMember>(`/chats/${chatId}/members`, { email });
export const removeChatMember = (chatId: string, email: string) =>
  apiClient.delete<void>(`/chats/${chatId}/members/${encodeURIComponent(email)}`);
export const leaveChat = (chatId: string) => apiClient.delete<void>(`/chats/${chatId}/membership`);

/** Owner first, then invited members. Visible to every member of the chat. */
export function useChatMembers(chatId: string, enabled = true): UseQueryResult<ChatMember[], ApiError> {
  return useQuery({
    queryKey: queryKeys.members(chatId),
    queryFn: () => fetchChatMembers(chatId),
    enabled,
  });
}

/** Owner-only: gives the user with this email access to the chat right away. */
export function useAddChatMember(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation<ChatMember, ApiError, string>({
    mutationFn: (email) => addChatMember(chatId, email),
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
    mutationFn: (email) => removeChatMember(chatId, email),
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
    mutationFn: () => leaveChat(chatId),
    onSuccess: () => {
      queryClient.setQueryData<Chat[]>(queryKeys.chats(), (existing) => existing?.filter((c) => c.id !== chatId));
      queryClient.removeQueries({ queryKey: queryKeys.chat(chatId) });
      queryClient.removeQueries({ queryKey: queryKeys.messages(chatId) });
      queryClient.removeQueries({ queryKey: queryKeys.members(chatId) });
    },
  });
}
