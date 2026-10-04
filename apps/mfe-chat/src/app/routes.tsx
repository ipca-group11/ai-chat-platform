import { createRoute, useRouterState, type AnyRoute } from "@tanstack/react-router";
import { ChatListPage } from "./ChatListPage";
import { ChatDetailPage } from "./ChatDetailPage";
import { CurrentUserGate } from "./auth-context";
import { loadChatView } from "./lazy-chat-view";

// Opening a chat directly: fetch the chat view code now rather than after the user check (AICHAT-239).
if (typeof window !== "undefined" && /^\/chats\/[^/]+/.test(window.location.pathname)) void loadChatView();

/**
 * Registers this remote's routes onto the shell's root route (FE-1).
 * `apps/shell` (platform pod) owns the root route/router instance and the
 * shared TanStack Query client; it imports `createChatRoutes` and attaches
 * the returned routes under its own tree so `/chats` and `/chats/:chatId`
 * become part of the single app-wide router (consumed as the shell's own
 * AC-22/AC-23, per docs/pods/chat/PLAN.md FE-1).
 */
export function createChatRoutes(parentRoute: AnyRoute) {
  const chatListRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/chats",
    component: ChatListPage,
  });

  const chatDetailRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/chats/$chatId",
    component: ChatDetailPage,
  });

  return [chatListRoute, chatDetailRoute] as const;
}

/**
 * Default export mounted by the shell's remote loader (`React.lazy(() => import("mfeChat/routes"))`)
 * on /chats and /chats/$chatId: renders the list or the chat for the current path. The
 * shell mounts it behind its auth guard without a user context, so the gate resolves
 * the signed-in user from the session.
 */
export default function ChatRoutes() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <CurrentUserGate>
      {/^\/chats\/[^/]+/.test(pathname) ? <ChatDetailPage /> : <ChatListPage />}
    </CurrentUserGate>
  );
}
