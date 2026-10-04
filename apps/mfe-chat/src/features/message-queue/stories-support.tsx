import { useState } from "react";
import type { Decorator } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "../../shared/query-keys";
import type { Message } from "../../shared/types";

/**
 * Helpers for the message-queue stories. The chat's messages come from a seeded query cache
 * (as in the chat view), and the edit/cancel requests are answered in memory, so the stories
 * never reach conversation-service.
 */

const QUEUED_MESSAGE_PATH = /^\/api\/chats\/[^/]+\/messages\/([^/]+)$/;

/** Story-level `beforeEach`: answers PATCH/DELETE on a queued message and restores `fetch` after the story. */
export function withQueueApiStub(): () => void {
  const original = window.fetch;
  window.fetch = (input, init) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return original(input, init);
    const match = QUEUED_MESSAGE_PATH.exec(url.pathname);
    const method = (init?.method ?? "GET").toUpperCase();
    if (match && method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
    if (match && method === "PATCH") {
      const { content } = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { content: string };
      const id = match[1] ?? "";
      const cached = editedMessages.get(id);
      return Promise.resolve(Response.json({ message: { ...cached, id, content } }));
    }
    return Promise.resolve(Response.json({ message: "Not available in Storybook" }, { status: 503 }));
  };
  return () => {
    window.fetch = original;
  };
}

/** The story's messages by id, so an edit answers with the full message, as the server does. */
const editedMessages = new Map<string, Message>();

/** A fresh QueryClient per story, with `args.chatId`'s messages cached from `args.messages`. */
export const WithMessagesCache: Decorator = (Story, context) => {
  const { chatId, messages } = context.args as { chatId: string; messages: Message[] };
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
    });
    editedMessages.clear();
    for (const message of messages) editedMessages.set(message.id, message);
    queryClient.setQueryData(queryKeys.messages(chatId), messages);
    return queryClient;
  });
  return (
    <QueryClientProvider client={client}>
      <Story />
    </QueryClientProvider>
  );
};
