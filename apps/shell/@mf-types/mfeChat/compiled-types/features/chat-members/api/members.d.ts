import { type UseQueryResult } from "@tanstack/react-query";
import { type ApiError } from "../../../shared/api-client";
import type { ChatMember } from "../../../shared/types";
/** Owner first, then invited members. Visible to every member of the chat. */
export declare function useChatMembers(chatId: string, enabled?: boolean): UseQueryResult<ChatMember[], ApiError>;
/** Owner-only: gives the user with this email access to the chat right away. */
export declare function useAddChatMember(chatId: string): import("@tanstack/react-query").UseMutationResult<ChatMember, ApiError, string, unknown>;
/** Owner-only: revokes a member's access. */
export declare function useRemoveChatMember(chatId: string): import("@tanstack/react-query").UseMutationResult<void, ApiError, string, unknown>;
/** A member leaves a chat that was shared with them. */
export declare function useLeaveChat(chatId: string): import("@tanstack/react-query").UseMutationResult<void, ApiError, void, unknown>;
