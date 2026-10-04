import { useEffect, useState, type ReactNode } from "react";
import type { Decorator } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/query-keys";
import type { Chat, ChatMember, Message, WebFetch } from "../../../shared/types";

/**
 * Fixtures and decorators shared by the chat-view stories. The data follows the shapes in
 * `packages/shared-types/src/__fixtures__` (same people, same chat) so every story shows
 * the same conversation the contract tests use.
 */

export const STORY_USER_ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
export const STORY_OTHER_USER_ID = "8c4d2e1f-7a6b-4c5d-9e8f-0a1b2c3d4e5f";
export const STORY_CHAT_ID = "7d9e1f2a-3b4c-4d5e-8f60-718293a4b5c6";

export const storyChat: Chat = {
  id: STORY_CHAT_ID,
  ownerId: STORY_USER_ID,
  ownerEmail: "ana@example.com",
  title: "Weekly planning",
  provider: "anthropic",
  model: "claude-sonnet-5-5",
  reasoning: true,
  webFetch: true,
  createdAt: "2026-10-03T09:15:30.000Z",
  updatedAt: "2026-10-03T09:20:45.123Z",
};

let sequence = 0;
/** Message ids only need to be unique within a story. */
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function userMessage(content: string, patch: Partial<Message> = {}): Message {
  return {
    id: nextId("user"),
    chatId: STORY_CHAT_ID,
    authorId: STORY_USER_ID,
    authorEmail: "ana@example.com",
    role: "user",
    content,
    attachments: [],
    status: "sent",
    createdAt: "2026-10-03T09:16:00.000Z",
    ...patch,
  };
}

export function assistantMessage(content: string, patch: Partial<Message> = {}): Message {
  return {
    id: nextId("assistant"),
    chatId: STORY_CHAT_ID,
    authorId: STORY_USER_ID,
    authorEmail: null,
    role: "assistant",
    content,
    reasoning: null,
    webFetches: [],
    attachments: [],
    status: "sent",
    createdAt: "2026-10-03T09:16:05.000Z",
    ...patch,
  };
}

export const markdownReply = [
  "Here is a plan for the week, based on the notes you shared:",
  "",
  "## Priorities",
  "",
  "1. **Finish the release notes** for v2.4 by Tuesday.",
  "2. Review the open pull requests on the `conversation-service`.",
  "3. Book a 30-minute retro with the design team.",
  "",
  "| Day | Focus | Owner |",
  "| --- | --- | --- |",
  "| Mon | Release notes | Ana |",
  "| Wed | Code review | Rui |",
  "| Fri | Retro | Team |",
  "",
  "> Keep Thursday free for unplanned work.",
  "",
  "A quick way to list the open pull requests:",
  "",
  "```bash",
  "gh pr list --state open --label needs-review",
  "```",
].join("\n");

export const storyReasoning = [
  "The user wants a weekly plan built from their notes.",
  "The notes mention three things: release notes due Tuesday, open reviews, and a retro.",
  "Order them by deadline, put them in a small table, and suggest keeping one day free.",
].join("\n");

export const storyWebFetches: WebFetch[] = [
  {
    id: "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b",
    url: "https://example.com/article",
    status: "done",
    title: "Example article",
  },
  {
    id: "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5c",
    url: "https://www.wikipedia.org/wiki/Retrospective",
    status: "done",
  },
  {
    id: "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5d",
    url: "https://intranet.example.org/roadmap",
    status: "error",
    errorCode: "url_not_accessible",
  },
];

/** A short, finished exchange: question, then a markdown answer with its reasoning and sources. */
export function storyConversation(): Message[] {
  return [
    userMessage("Can you turn my notes into a plan for this week? The roadmap is at https://intranet.example.org/roadmap", {
      attachments: [
        {
          id: "c0ffee00-1234-4abc-9def-0123456789ab",
          messageId: "user-notes",
          filename: "notes.pdf",
          mimeType: "application/pdf",
          size: 20480,
          kind: "pdf",
        },
      ],
    }),
    assistantMessage(markdownReply, { reasoning: storyReasoning, webFetches: storyWebFetches }),
  ];
}

const followUps: Array<[string, string]> = [
  ["What should go into the release notes?", "Start with the **user-facing changes**, then fixes, then anything deprecated."],
  ["Can you draft the first section?", "### New\n\n- Shared chats: invite teammates by email.\n- Reasoning toggle for models that support it."],
  ["Make it shorter.", "### New\n\n- Shared chats\n- Reasoning toggle"],
  ["Who should review it?", "Rui knows the sharing feature best; ask Marta to check the wording."],
  ["Thanks! Anything else for Monday?", "Clear your review queue before lunch so Wednesday stays focused."],
];

/** Many turns, to show scrolling and spacing over a long history. */
export function storyLongConversation(): Message[] {
  return [
    ...storyConversation(),
    ...followUps.flatMap(([question, answer]) => [userMessage(question), assistantMessage(answer)]),
  ];
}

const storyMembers: ChatMember[] = [
  { email: "ana@example.com", role: "owner", addedAt: "2026-10-03T09:15:30.000Z" },
  { email: "rui@example.com", role: "member", addedAt: "2026-10-03T10:02:11.000Z" },
];

/** What the fake conversation-service answers for one story. */
export interface ChatApiParameters {
  /** The chat itself; `"loading"` never answers, `"not-found"` answers 404. */
  chat: Chat | "loading" | "not-found";
  messages?: Message[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * Stands in for conversation-service: answers the requests the chat view makes from the
 * story's data, so nothing leaves the browser. Mutations (stop, retry, toggles, send)
 * answer like the service would, without changing the story's data.
 */
function fakeFetch(api: ChatApiParameters): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^.*?\/chats/, "/chats");
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const messages = api.messages ?? [];

    if (api.chat === "loading") return new Promise<Response>(() => undefined);
    if (api.chat === "not-found") return json({ message: "Chat not found" }, 404);
    const chat = api.chat;

    if (path.endsWith("/members")) return json({ members: storyMembers });
    if (/\/messages\/[^/]+\/stop$/.test(path)) return new Response(null, { status: 204 });
    if (/\/messages\/[^/]+\/retry$/.test(path)) {
      const messageId = path.split("/").at(-2);
      const failed = messages.find((m) => m.id === messageId);
      return json({ message: { ...failed, status: "streaming", content: "", error: null } }, 202);
    }
    if (path.endsWith("/messages") && method === "POST") {
      return json({ message: userMessage(String(body.content ?? "")) }, 201);
    }
    if (path.endsWith("/messages")) return json({ messages });
    if (method === "PATCH") return json({ chat: { ...chat, ...body } });
    return json({ chat });
  };
}

/** An EventSource that never connects: the stories show a fixed moment of the stream. */
class SilentEventSource extends EventTarget {
  readonly url: string;
  readonly withCredentials: boolean;
  readonly readyState = 1;
  onopen = null;
  onmessage = null;
  onerror = null;
  constructor(url: string | URL, init?: EventSourceInit) {
    super();
    this.url = String(url);
    this.withCredentials = Boolean(init?.withCredentials);
  }
  close(): void {
    // Nothing to close.
  }
}

const realFetch = window.fetch;
const RealEventSource = window.EventSource;

function installFakeTransport(api: ChatApiParameters): void {
  window.fetch = fakeFetch(api);
  window.EventSource = SilentEventSource as unknown as typeof EventSource;
}

function restoreTransport(): void {
  window.fetch = realFetch;
  window.EventSource = RealEventSource;
}

function StoryChatApi({ api, children }: { api: ChatApiParameters; children: ReactNode }) {
  const [queryClient] = useState(() => {
    // Installed before the first render, because the chat view's queries and its stream
    // start in effects that run before this component's own effect.
    installFakeTransport(api);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
        mutations: { retry: false },
      },
    });
    if (typeof api.chat === "object") {
      client.setQueryData(queryKeys.chat(api.chat.id), api.chat);
      client.setQueryData(queryKeys.messages(api.chat.id), api.messages ?? []);
    }
    return client;
  });

  useEffect(() => {
    installFakeTransport(api);
    return restoreTransport;
  }, [api]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Serves `parameters.chatApi` to the story through a seeded QueryClient and a fake transport. */
export const withChatApi: Decorator = (Story, context) => {
  const api = (context.parameters.chatApi as ChatApiParameters | undefined) ?? { chat: storyChat, messages: [] };
  return (
    <StoryChatApi key={context.id} api={api}>
      <Story />
    </StoryChatApi>
  );
};
