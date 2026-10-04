import { type UseQueryResult } from "@tanstack/react-query";
import { ApiError } from "../../../shared/api-client";
import type { Chat, Provider } from "../../../shared/types";
/** AC-42 (list), AC-47 (server scopes to owner; this hook just renders what it gets back). */
export declare function useChats(): UseQueryResult<Chat[], ApiError>;
/** AC-42 (open), AC-43 (restores on reload/relogin via refetch-on-mount), AC-46 (403/404 surfaced). */
export declare function useChat(chatId: string | undefined): UseQueryResult<Chat, ApiError>;
export interface CreateChatInput {
    title: string;
    provider: Provider;
    model: string;
    reasoning?: boolean;
    webFetch?: boolean;
}
/** AC-42 (create), AC-48/AC-49 (provider+model chosen and persisted at creation). */
export declare function useCreateChat(): import("@tanstack/react-query").UseMutationResult<Chat, Error, CreateChatInput, unknown>;
export interface UpdateChatInput {
    chatId: string;
    title?: string;
    provider?: Provider;
    model?: string;
    reasoning?: boolean;
    webFetch?: boolean;
}
/** AC-42 (rename), AC-48/AC-49 (provider+model edit persisted). */
export declare function useUpdateChat(): import("@tanstack/react-query").UseMutationResult<Chat, Error, UpdateChatInput, unknown>;
/** AC-42 (delete), AC-44 (removed chat/messages no longer appear or load). */
export declare function useDeleteChat(): import("@tanstack/react-query").UseMutationResult<void, Error, string, unknown>;
