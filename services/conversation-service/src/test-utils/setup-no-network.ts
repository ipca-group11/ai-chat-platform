/** Vitest setup file: replaces the global `fetch` so a test can never reach a real
 * provider by accident. Adapters get their `fetch` through `fetchImpl`; one built
 * without it would fall back to the global and fail here instead of hitting the network. */
export const NETWORK_DISABLED_MESSAGE = "Network access is disabled in tests";

globalThis.fetch = (() => {
  throw new Error(NETWORK_DISABLED_MESSAGE);
}) as typeof fetch;
