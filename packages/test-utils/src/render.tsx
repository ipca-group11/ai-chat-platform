import type { ComponentType, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderHookResult,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";

type Wrapper = ComponentType<{ children: ReactNode }>;

/** A QueryClient for tests: no retries, so a failed request fails the test at once. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/**
 * A wrapper component that provides `client` (a fresh test client by default). Use it where a
 * test still calls Testing Library directly: `render(ui, { wrapper: withQueryClient() })`.
 */
export function withQueryClient(client: QueryClient = createTestQueryClient(), Inner?: Wrapper): Wrapper {
  return function QueryClientWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{Inner ? <Inner>{children}</Inner> : children}</QueryClientProvider>
    );
  };
}

export interface ClientOptions {
  /** Use this client instead of a fresh one, for example to seed the cache before rendering. */
  queryClient?: QueryClient;
  /** Providers that go inside the QueryClientProvider (router, auth context, ...). */
  wrapper?: Wrapper;
}

export type RenderWithClientResult = RenderResult & { queryClient: QueryClient };

/** `render` inside a QueryClientProvider. Returns the Testing Library result plus the client. */
export function renderWithClient(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), wrapper, ...options }: ClientOptions & Omit<RenderOptions, "wrapper"> = {},
): RenderWithClientResult {
  return { queryClient, ...render(ui, { ...options, wrapper: withQueryClient(queryClient, wrapper) }) };
}

export type RenderHookWithClientResult<Result, Props> = RenderHookResult<Result, Props> & { queryClient: QueryClient };

/** `renderHook` inside a QueryClientProvider. Returns the Testing Library result plus the client. */
export function renderHookWithClient<Result, Props>(
  hook: (props: Props) => Result,
  {
    queryClient = createTestQueryClient(),
    wrapper,
    ...options
  }: ClientOptions & Omit<RenderHookOptions<Props>, "wrapper"> = {},
): RenderHookWithClientResult<Result, Props> {
  return { queryClient, ...renderHook(hook, { ...options, wrapper: withQueryClient(queryClient, wrapper) }) };
}
