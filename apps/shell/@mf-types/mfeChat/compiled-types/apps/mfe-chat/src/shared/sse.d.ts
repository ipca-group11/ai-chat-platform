import type { SSEEvent } from "./types";
export interface StreamHandlers {
    /** A user message was posted to the chat (by you or another member). */
    onMessage?: (event: Extract<SSEEvent, {
        type: "message";
    }>) => void;
    /** The server picked the message up and created the (still empty) assistant reply. */
    onStarted?: (event: Extract<SSEEvent, {
        type: "started";
    }>) => void;
    onToken: (event: Extract<SSEEvent, {
        type: "token";
    }>) => void;
    /** A piece of the model's reasoning, streamed before (or between) the answer tokens. */
    onReasoning?: (event: Extract<SSEEvent, {
        type: "reasoning";
    }>) => void;
    /** The model started fetching a page, or a fetch finished (same `fetch.id`). */
    onWebFetch?: (event: Extract<SSEEvent, {
        type: "web_fetch";
    }>) => void;
    onDone: (event: Extract<SSEEvent, {
        type: "done";
    }>) => void;
    onError: (event: Extract<SSEEvent, {
        type: "error";
    }>) => void;
    /** Native transport-level error (connection dropped), distinct from a provider `error` event. */
    onConnectionError?: (event: Event) => void;
}
export interface ChatStream {
    close: () => void;
}
/**
 * Subscribes to `GET /chats/:id/stream` (SSE) for a single chat. Multiple
 * chats each get their own independent `EventSource`/subscription so
 * switching chats never interrupts another chat's in-progress stream
 * (FR7/AC-60/AC-61).
 */
export declare function subscribeToChatStream(chatId: string, handlers: StreamHandlers): ChatStream;
