import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./app";

// Standalone dev/preview bootstrap (`vite`/`vite preview`, i.e. the Nx `serve` target).
// When mounted inside the shell via Module Federation, `routes.tsx` is used instead and
// reuses the shell's shared `QueryClient`/router (docs/ARCHITECTURE.md §4); this file
// only runs when `mfe-settings` is served on its own, e.g. for local development.
const queryClient = new QueryClient();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container '#root' not found");
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
