import { type UseQueryResult } from "@tanstack/react-query";
import { type ApiError } from "../../../shared/api-client";
import type { Message, Provider } from "../../../shared/types";
/**
 * AC-53: the full conversation history is sent to the LLM as context on every
 * request. That concatenation happens server-side in `conversation-service`
 * (it owns the history); this hook is what supplies that same history to the
 * chat view for rendering, and its query key is what `conversation-service`'s
 * response is expected to keep in sync with.
 */
export declare function useMessages(chatId: string | undefined): UseQueryResult<Message[], ApiError>;
export interface SendMessageInput {
    chatId: string;
    content: string;
    attachmentIds?: string[];
    userId: string;
    provider: Provider;
}
/** AC-51: persisted immediately and shown; also (re)opens this chat's stream (AC-60/AC-61). */
export declare function useSendMessage(): import("@tanstack/react-query").UseMutationResult<Message, Error, SendMessageInput, unknown>;
/** AC-54: stop a response mid-stream; the partial response is saved server-side and re-synced here. */
export declare function useStopMessage(): import("@tanstack/react-query").UseMutationResult<void, Error, {
    chatId: string;
    messageId: string;
}, unknown>;
export interface RetryMessageInput {
    chatId: string;
    messageId: string;
    /** Whose key to send: the retry calls the LLM again, just like a send. */
    userId: string;
    provider: Provider;
}
/** AC-73: retry a message that failed due to a provider error. */
export declare function useRetryMessage(): import("@tanstack/react-query").UseMutationResult<Message, Error, RetryMessageInput, unknown>;
/** AC-58: edit a queued message before its processing starts. */
export declare function useEditQueuedMessage(): import("@tanstack/react-query").UseMutationResult<Message, Error, {
    chatId: string;
    messageId: string;
    content: string;
}, unknown>;
/** AC-58: cancel a queued message before its processing starts. */
export declare function useCancelQueuedMessage(): import("@tanstack/react-query").UseMutationResult<void, Error, {
    chatId: string;
    messageId: string;
}, unknown>;
