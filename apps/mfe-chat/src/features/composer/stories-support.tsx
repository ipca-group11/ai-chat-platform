import { useState } from "react";
import type { Decorator } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Helpers for the composer stories.
 * Stories never reach conversation-service: every `/api/...` request is answered in memory
 * by the routes a story declares in `parameters.api` (see `withApiStub`).
 */

/** How a stubbed endpoint answers: a JSON response, a request that never settles, or a dropped connection. */
export type StubResponse = { status: number; body?: unknown } | "pending" | "network-error";

export interface StubRoute {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: RegExp;
  respond: StubResponse | ((body: RequestInit["body"]) => StubResponse);
}

/** Matches the app's API base (`/api`, see shared/api-client.ts); anything unmatched under it fails offline. */
const API_PREFIX = /^\/api\//;

function toResponse(answer: StubResponse): Promise<Response> {
  if (answer === "pending") return new Promise<Response>(() => undefined);
  if (answer === "network-error") return Promise.reject(new TypeError("Failed to fetch"));
  return Promise.resolve(
    answer.body === undefined
      ? new Response(null, { status: answer.status })
      : Response.json(answer.body, { status: answer.status })
  );
}

/** Replaces `window.fetch` for app API calls; returns the function that restores it. */
export function stubApi(routes: readonly StubRoute[]): () => void {
  const original = window.fetch;
  window.fetch = (input, init) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !API_PREFIX.test(url.pathname)) {
      return original(input, init);
    }
    const method = (init?.method ?? "GET").toUpperCase();
    const route = routes.find((r) => r.method === method && r.path.test(url.pathname));
    if (!route) return toResponse({ status: 503, body: { message: "Not available in Storybook" } });
    return toResponse(typeof route.respond === "function" ? route.respond(init?.body) : route.respond);
  };
  return () => {
    window.fetch = original;
  };
}

/** Story-level `beforeEach`: installs `parameters.api` and restores `fetch` after the story. */
export function withApiStub({ parameters }: { parameters: { api?: readonly StubRoute[] } }): () => void {
  return stubApi(parameters.api ?? []);
}

/** A fresh QueryClient per story, so mutations from one story never leak into another. */
export const WithQueryClient: Decorator = (Story) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <Story />
    </QueryClientProvider>
  );
};

// Play-function helpers: drive the real inputs the way a user would, so React's own
// change handlers run and the component reaches the state under test.

export function typeInto(field: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

export function chooseFiles(input: HTMLInputElement, files: readonly File[]): void {
  // A FileList-shaped value instead of `new DataTransfer().files`: jsdom, where the DOM
  // snapshots of these stories run, has no DataTransfer.
  const list = Object.assign([...files], { item: (index: number) => files[index] ?? null });
  Object.defineProperty(input, "files", { configurable: true, value: list });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function getByLabel<T extends HTMLElement>(root: HTMLElement, label: string): T {
  const element = root.querySelector<T>(`[aria-label="${label}"]`);
  if (!element) throw new Error(`No element labelled "${label}"`);
  return element;
}

export function getButton(root: HTMLElement, name: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.trim() === name);
  if (!button) throw new Error(`No "${name}" button`);
  return button;
}

/** Lets React flush the updates queued by the events above (and any settled stub responses). */
export function settle(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A file with real bytes of the given size, so the client-side validators see what the user picked. */
export function makeFile(name: string, type: string, size = 2048): File {
  return new File([new Uint8Array(size)], name, { type });
}
