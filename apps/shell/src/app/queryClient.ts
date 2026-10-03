import { QueryClient } from '@tanstack/react-query';

/**
 * Single shared TanStack Query client for the shell host.
 *
 * Per AC-25, this module is exported as a federation-shared singleton (see
 * `module-federation.config.ts`, `shared['@tanstack/react-query']`) so that
 * `mfe-auth`, `mfe-chat`, and `mfe-settings` reuse this instance instead of
 * creating their own `QueryClient`, keeping cache/state consistent across the
 * micro-frontends mounted inside the host.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
