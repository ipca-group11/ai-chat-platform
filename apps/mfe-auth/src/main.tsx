import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { createAuthRoutes } from "./routes";

// Standalone dev/preview entry (`vite dev` / `vite preview` run directly against this
// app, e.g. `nx serve mfe-auth`). When mounted inside the shell via Module Federation,
// the shell uses `./routes` (see `routes.tsx`) directly against its own router instead
// of this file — this entry exists only so the remote is runnable/previewable on its
// own (PLAN.md F1).
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const [loginRoute, registerRoute] = createAuthRoutes(rootRoute);
const routeTree = rootRoute.addChildren([loginRoute, registerRoute]);

// Note: deliberately not augmenting `@tanstack/react-router`'s `Register` type with this
// router. This app only owns `/login` and `/register`; other routes such as `/chats`
// (owned by `chat`/`shell`) are navigated to across the remote boundary and are outside
// this router's type-safe route tree, so a global `Register` augmentation here would
// incorrectly narrow every `navigate({ to })` call in this app to only its own two
// routes. The real, fully-typed route tree is owned by the shell host at runtime.
const router = createRouter({ routeTree, defaultPreload: "intent" });

const queryClient = new QueryClient();

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
