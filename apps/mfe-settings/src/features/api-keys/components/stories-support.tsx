import { useState } from "react";
import type { Decorator } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Shared helpers for the api-keys stories. Stories never reach auth-service or
 * conversation-service: `GET /auth/me` and `POST /providers/:provider/test-connection` are
 * answered in memory by the routes a story declares in `parameters.api`.
 */

/** How a stubbed endpoint answers: a JSON response, a request that never settles, or a dropped connection. */
export type StubResponse = { status: number; body?: unknown } | "pending" | "network-error";

export interface StubRoute {
  method: "GET" | "POST";
  path: RegExp;
  respond: StubResponse;
}

/** The endpoints this feature calls (see api/auth.ts and api/testConnection.ts); anything unmatched fails offline. */
const APP_ENDPOINTS = /^\/(auth|providers)\//;

function toResponse(answer: StubResponse): Promise<Response> {
  if (answer === "pending") return new Promise<Response>(() => undefined);
  if (answer === "network-error") return Promise.reject(new TypeError("Failed to fetch"));
  return Promise.resolve(Response.json(answer.body ?? {}, { status: answer.status }));
}

/** Replaces `window.fetch` for the feature's endpoints; returns the function that restores it. */
export function stubApi(routes: readonly StubRoute[]): () => void {
  const original = window.fetch;
  window.fetch = (input, init) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    if (!APP_ENDPOINTS.test(url.pathname)) return original(input, init);
    const method = (init?.method ?? "GET").toUpperCase();
    const route = routes.find((r) => r.method === method && r.path.test(url.pathname));
    return toResponse(route ? route.respond : { status: 503, body: { message: "Not available in Storybook" } });
  };
  return () => {
    window.fetch = original;
  };
}

/** Story-level `beforeEach`: installs `parameters.api` and restores `fetch` after the story. */
export function withApiStub({ parameters }: { parameters: { api?: readonly StubRoute[] } }): () => void {
  return stubApi(parameters.api ?? []);
}

/** Seeds a story's QueryClient, so cached queries never fetch. */
export type SeedQueryClient = (client: QueryClient) => void;

/** A fresh QueryClient per story, optionally seeded through `parameters.seed`. */
export const WithQueryClient: Decorator = (Story, context) => {
  const seed = context.parameters.seed as SeedQueryClient | null | undefined;
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
    });
    seed?.(queryClient);
    return queryClient;
  });
  return (
    <QueryClientProvider client={client}>
      <Story />
    </QueryClientProvider>
  );
};

// Play-function helpers: drive the real inputs the way a user would, so React's own
// change handlers run and the component reaches the state under test.

export function typeInto(field: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

export function getButton(root: HTMLElement, name: string | RegExp): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll("button")).find((b) => {
    const text = b.textContent?.trim() ?? "";
    return typeof name === "string" ? text === name : name.test(text);
  });
  if (!button) throw new Error(`No "${String(name)}" button`);
  return button;
}

/** Lets React flush the updates queued by the events above (and any settled stub responses). */
export function settle(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
