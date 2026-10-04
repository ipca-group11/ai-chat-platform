import { useEffect, useState, type ReactNode } from "react";
import type { Decorator } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { sampleChats } from "../features/chat-list/components/stories-support";
import { STORY_USER_ID, storyChat, storyConversation } from "../features/chat-view/components/stories-support";
import type { Chat, Message } from "../shared/types";
import { CurrentUserProvider } from "./auth-context";

/**
 * Helpers for the stories of the remote's app shell (workspace, pages and session gate).
 * The fixtures come from the chat-list and chat-view stories, so the sidebar and the open
 * chat show the same data there and here. A fake backend in the browser answers what the
 * workspace asks for; anything else stays pending, so nothing reaches a real server.
 */

export { STORY_USER_ID };

/** The sidebar's chats, with the open chat ("Weekly planning") first. */
export const workspaceChats: Chat[] = sampleChats.map((chat) => (chat.id === storyChat.id ? storyChat : chat));

/** A short, finished exchange in the open chat. */
export const workspaceMessages: Record<string, Message[]> = { [storyChat.id]: storyConversation() };

export const OPEN_CHAT_ID = storyChat.id;

/** What the fake backend answers for one story (`parameters.backend`). */
export interface StoryBackend {
  chats: Chat[];
  /** Messages per chat id; chats not listed have none. */
  messages?: Record<string, Message[]>;
  /** `GET /auth/me`: the signed-in user, never answered, or a failed status. */
  session?: "signed-in" | "pending" | 401;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const pending = () => new Promise<Response>(() => undefined);

function fakeFetch(backend: StoryBackend): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname;

    if (path.endsWith("/auth/me")) {
      const session = backend.session ?? "signed-in";
      if (session === "pending") return pending();
      if (session === 401) return json({ error: { code: "UNAUTHENTICATED", message: "Not authenticated" } }, 401);
      return json({ id: STORY_USER_ID, email: "ana@example.com" });
    }
    if (method !== "GET") return pending();
    if (/\/api\/chats$/.test(path)) return json({ chats: backend.chats });
    const match = /\/api\/chats\/([^/]+)(\/.*)?$/.exec(path);
    if (match) {
      const chat = backend.chats.find((c) => c.id === match[1]);
      if (!chat) return json({ error: { code: "NOT_FOUND", message: "Chat not found" } }, 404);
      const rest = match[2] ?? "";
      if (rest === "") return json({ chat });
      if (rest === "/messages") return json({ messages: backend.messages?.[chat.id] ?? [] });
      if (rest === "/members") return json({ members: [{ email: "ana@example.com", role: "owner", addedAt: chat.createdAt }] });
    }
    // Anything a story does not cover stays pending rather than reaching a real server.
    return pending();
  };
}

/** An EventSource that never connects: the stories show a settled conversation. */
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
/** Where the workspace remembers its split panes (see split-panes.ts). */
const SPLIT_LAYOUT_KEY = "mfe-chat:split-layout";

function installFakeTransport(backend: StoryBackend): void {
  window.fetch = fakeFetch(backend);
  window.EventSource = SilentEventSource as unknown as typeof EventSource;
}

function restoreTransport(): void {
  window.fetch = realFetch;
  window.EventSource = RealEventSource;
}

function StoryBackendProvider({ backend, children }: { backend: StoryBackend; children: ReactNode }) {
  const [client] = useState(() => {
    // Installed before the first render: the queries start while rendering.
    installFakeTransport(backend);
    try {
      // Every story starts from a single pane, whatever an earlier one left behind.
      window.localStorage.removeItem(SPLIT_LAYOUT_KEY);
    } catch {
      // Storage unavailable: the layout starts empty anyway.
    }
    return new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
        mutations: { retry: false },
      },
    });
  });

  useEffect(() => {
    installFakeTransport(backend);
    return restoreTransport;
  }, [backend]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Serves `parameters.backend` through a fresh QueryClient and a fake fetch/EventSource. */
export const withBackend: Decorator = (Story, context) => {
  const backend = (context.parameters.backend as StoryBackend | undefined) ?? { chats: workspaceChats, messages: workspaceMessages };
  return (
    <StoryBackendProvider key={context.id} backend={backend}>
      <Story />
    </StoryBackendProvider>
  );
};

/** Provides the signed-in user's id, as the shell does once its auth guard has passed. */
export const withCurrentUser: Decorator = (Story) => (
  <CurrentUserProvider userId={STORY_USER_ID}>
    <Story />
  </CurrentUserProvider>
);

function StoryRouter({ path, children }: { path: string; children: () => ReactNode }) {
  const [router] = useState(() => {
    const root = createRootRoute();
    const list = createRoute({ getParentRoute: () => root, path: "/chats", component: () => children() });
    const detail = createRoute({ getParentRoute: () => root, path: "/chats/$chatId", component: () => children() });
    return createRouter({
      routeTree: root.addChildren([list, detail]),
      history: createMemoryHistory({ initialEntries: [path] }),
    });
  });
  return <RouterProvider router={router} />;
}

/**
 * Renders the story on the remote's two routes (`/chats` and `/chats/$chatId`), starting at
 * `parameters.path`, or at the chat in `args.chatId` when there is one.
 */
export const withChatRoutes: Decorator = (Story, context) => {
  const chatId = (context.args as { chatId?: string }).chatId;
  const path = (context.parameters.path as string | undefined) ?? (chatId ? `/chats/${chatId}` : "/chats");
  return <StoryRouter key={context.id} path={path}>{() => <Story />}</StoryRouter>;
};

/** Full-height frame like the shell's content area. */
export const withWorkspaceFrame: Decorator = (Story) => (
  <div className="flex h-[640px] flex-col overflow-hidden">
    <Story />
  </div>
);

/**
 * `play` that waits until the story shows `text`: the route and the queries resolve after
 * the first render, so the story (and its DOM snapshot) is the finished state.
 */
export const showsText =
  (text: string | RegExp, timeout = 5000) =>
  async ({ canvasElement }: { canvasElement: HTMLElement }): Promise<void> => {
    const shown = () => {
      const content = canvasElement.textContent ?? "";
      return typeof text === "string" ? content.includes(text) : text.test(content);
    };
    const deadline = performance.now() + timeout;
    while (!shown()) {
      if (performance.now() > deadline) throw new Error(`The story never showed ${String(text)}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
