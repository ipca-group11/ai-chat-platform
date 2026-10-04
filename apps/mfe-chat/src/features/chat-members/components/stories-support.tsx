import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import type { Decorator } from "@storybook/react-vite";
import { ApiError } from "../../../shared/api-client";
import type { ChatMember } from "../../../shared/types";

/**
 * Cache state a story starts from, per query key:
 * - `data`: the query already resolved with this value (never refetched);
 * - `loading`: a request is in flight and never settles;
 * - `error`: the request failed with this message.
 */
export type SeededQuery =
  | { key: QueryKey; data: unknown }
  | { key: QueryKey; loading: true }
  | { key: QueryKey; error: string; status?: number };

function createStoryQueryClient(seed: SeededQuery[]): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      // Whatever the seed says is final: no refetch on mount, focus or after an error, so the
      // stories never reach for the conversation service.
      queries: { staleTime: Infinity, retry: false, retryOnMount: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  for (const entry of seed) {
    if ("data" in entry) {
      client.setQueryData(entry.key, entry.data);
    } else if ("loading" in entry) {
      void client.prefetchQuery({ queryKey: entry.key, queryFn: () => new Promise<never>(() => undefined) });
    } else {
      void client.prefetchQuery({
        queryKey: entry.key,
        queryFn: () => Promise.reject(new ApiError(entry.status ?? 500, entry.error)),
      });
    }
  }
  return client;
}

/** Wraps a story in its own QueryClient, seeded from `parameters.queries`. */
export const withQueryClient: Decorator = (Story, context) => {
  const seed = (context.parameters.queries as SeededQuery[] | undefined) ?? [];
  // A fresh client per render keeps stories from sharing cache entries.
  const client = createStoryQueryClient(seed);
  return (
    <QueryClientProvider client={client}>
      <Story />
    </QueryClientProvider>
  );
};

/**
 * Kept apart from chat-list's story helpers because features may not import each other's
 * internals.
 */
export const SAMPLE_CHAT = { id: "7d9e1f2a-3b4c-4d5e-8f60-718293a4b5c6", title: "Weekly planning" };

/** Members of "Weekly planning": the owner first, then the invited people. */
export const sampleMembers: ChatMember[] = [
  { email: "ana@example.com", role: "owner", addedAt: "2026-09-28T08:00:00.000Z" },
  { email: "rui@example.com", role: "member", addedAt: "2026-09-29T10:12:00.000Z" },
  { email: "marta.silva@example.com", role: "member", addedAt: "2026-10-01T14:40:00.000Z" },
];
