/**
 * Ensures this chat has an open SSE subscription while its view is mounted.
 * Opening is idempotent (see `stream-registry`) and the underlying
 * subscription is intentionally *not* closed on unmount, so switching chats
 * never interrupts an in-progress stream (AC-60, AC-61).
 */
export declare function useMessageStream(chatId: string | undefined): void;
