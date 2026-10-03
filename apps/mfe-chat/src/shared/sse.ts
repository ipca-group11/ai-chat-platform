import { apiClient } from "./api-client";
import type { SSEEvent } from "./types";

export interface StreamHandlers {
  /** A user message was posted to the chat (by you or another member). */
  onMessage?: (event: Extract<SSEEvent, { type: "message" }>) => void;
  /** The server picked the message up and created the (still empty) assistant reply. */
  onStarted?: (event: Extract<SSEEvent, { type: "started" }>) => void;
  onToken: (event: Extract<SSEEvent, { type: "token" }>) => void;
  /** A piece of the model's reasoning, streamed before (or between) the answer tokens. */
  onReasoning?: (event: Extract<SSEEvent, { type: "reasoning" }>) => void;
  /** The model started fetching a page, or a fetch finished (same `fetch.id`). */
  onWebFetch?: (event: Extract<SSEEvent, { type: "web_fetch" }>) => void;
  onDone: (event: Extract<SSEEvent, { type: "done" }>) => void;
  onError: (event: Extract<SSEEvent, { type: "error" }>) => void;
  /** Native transport-level error (connection dropped), distinct from a provider `error` event. */
  onConnectionError?: (event: Event) => void;
}

export interface ChatStream {
  close: () => void;
}

function parse<T extends SSEEvent["type"]>(evt: Event): Extract<SSEEvent, { type: T }> {
  return JSON.parse((evt as MessageEvent<string>).data) as Extract<SSEEvent, { type: T }>;
}

/**
 * Subscribes to `GET /chats/:id/stream` (SSE) for a single chat. Multiple
 * chats each get their own independent `EventSource`/subscription so
 * switching chats never interrupts another chat's in-progress stream
 * (FR7/AC-60/AC-61).
 */
export function subscribeToChatStream(chatId: string, handlers: StreamHandlers): ChatStream {
  const source = new EventSource(`${apiClient.baseUrl}/chats/${chatId}/stream`, {
    withCredentials: true,
  });

  source.addEventListener("message", (evt) => handlers.onMessage?.(parse<"message">(evt)));
  source.addEventListener("started", (evt) => handlers.onStarted?.(parse<"started">(evt)));
  source.addEventListener("token", (evt) => handlers.onToken(parse<"token">(evt)));
  source.addEventListener("reasoning", (evt) => handlers.onReasoning?.(parse<"reasoning">(evt)));
  source.addEventListener("web_fetch", (evt) => handlers.onWebFetch?.(parse<"web_fetch">(evt)));
  source.addEventListener("done", (evt) => handlers.onDone(parse<"done">(evt)));

  // The server names provider failures `event: error`, which EventSource also uses for
  // transport errors: a server event is a MessageEvent carrying data, a transport error is not.
  source.addEventListener("error", (evt) => {
    if (evt instanceof MessageEvent && typeof evt.data === "string" && evt.data) {
      handlers.onError(parse<"error">(evt));
    } else {
      handlers.onConnectionError?.(evt);
    }
  });

  return {
    close: () => source.close(),
  };
}
