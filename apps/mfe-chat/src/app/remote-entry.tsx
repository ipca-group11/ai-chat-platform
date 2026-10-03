import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider, type QueryClient as QueryClientType } from "@tanstack/react-query";
import { RouterProvider, createRootRoute, createRouter } from "@tanstack/react-router";
import { CurrentUserProvider } from "./auth-context";
import { createChatRoutes } from "./routes";

export interface MountOptions {
  /** Authenticated user id, resolved by the shell's auth guard. */
  userId: string;
  /** The shell's shared TanStack Query client singleton (STACK.md §3). */
  queryClient?: QueryClientType;
}

let root: Root | null = null;

/**
 * Standalone (non-composed) mount entry point for this remote, used when the
 * shell mounts `mfe-chat` at a container element rather than composing its
 * route tree directly into the shell's own router (e.g. during local/dev
 * preview of this remote in isolation). Wires the shared query client and a
 * self-contained router covering `/chats` and `/chats/:chatId`.
 */
export function mount(container: HTMLElement, options: MountOptions): void {
  const rootRoute = createRootRoute();
  const routes = createChatRoutes(rootRoute);
  const routeTree = rootRoute.addChildren(routes);
  const router = createRouter({ routeTree, defaultPreload: "intent" });
  const queryClient = options.queryClient ?? new QueryClient();

  root = createRoot(container);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <CurrentUserProvider userId={options.userId}>
          <RouterProvider router={router} />
        </CurrentUserProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}

export function unmount(): void {
  root?.unmount();
  root = null;
}
