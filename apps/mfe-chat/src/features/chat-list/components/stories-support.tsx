import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import type { Decorator } from "@storybook/react-vite";
import { ApiError } from "../../../shared/api-client";
import type { Chat } from "../../../shared/types";

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

/** The signed-in user in the stories. */
export const CURRENT_USER_ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const OTHER_USER_ID = "9c8b7a6f-5e4d-4c3b-8a29-1f0e9d8c7b6a";

function chat(id: string, title: string, provider: Chat["provider"], model: string, updatedAt: string): Chat {
  return {
    id,
    title,
    ownerId: CURRENT_USER_ID,
    ownerEmail: "ana@example.com",
    provider,
    model,
    createdAt: "2026-09-28T08:00:00.000Z",
    updatedAt,
  };
}

/** A realistic sidebar: own chats on every provider, plus one shared by a teammate. */
export const sampleChats: Chat[] = [
  chat("7d9e1f2a-3b4c-4d5e-8f60-718293a4b5c6", "Weekly planning", "anthropic", "claude-haiku-4-5", "2026-10-03T09:20:45.123Z"),
  chat("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "Trip to Porto", "ollama", "llama3.2:1b", "2026-10-02T18:05:00.000Z"),
  {
    ...chat("2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "Thesis outline", "openai", "gpt-4o", "2026-10-02T11:30:00.000Z"),
    ownerId: OTHER_USER_ID,
    ownerEmail: "rui@example.com",
  },
  chat("3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f", "Refactor the auth middleware", "anthropic", "claude-sonnet-5-5", "2026-10-01T15:45:00.000Z"),
  chat("4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a", "Recipe ideas", "ollama", "qwen3:4b", "2026-09-30T19:10:00.000Z"),
  chat("5e6f7a8b-9c0d-4e1f-8a3b-4c5d6e7f8a9b", "SQL query review", "openai", "gpt-4.1", "2026-09-29T10:00:00.000Z"),
];

/** A long history, to show how the sidebar scrolls. */
export const manyChats: Chat[] = Array.from({ length: 24 }, (_, i) => {
  const base = sampleChats[i % sampleChats.length] as Chat;
  const round = Math.floor(i / sampleChats.length);
  return {
    ...base,
    id: `${base.id.slice(0, -2)}${String(i).padStart(2, "0")}`,
    title: round === 0 ? base.title : `${base.title} (${round + 1})`,
  };
});
