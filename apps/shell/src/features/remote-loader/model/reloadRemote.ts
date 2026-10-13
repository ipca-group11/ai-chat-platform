import { getInstance } from '@module-federation/runtime';
import type { ComponentType } from 'react';

type RemoteModule = { default: ComponentType };

/** The part of the Module Federation runtime instance `reloadRemote` uses. */
export interface FederationRuntime {
  options: { remotes: Array<{ name: string; alias?: string; entry?: string }> };
  registerRemotes(remotes: Array<Record<string, unknown>>, options: { force: boolean }): void;
  loadRemote<T>(id: string): Promise<T | null>;
}

/**
 * Loads `id` (e.g. `'mfeChat/routes'`) again after a failed attempt, for Retry (AICHAT-164).
 *
 * A failed load cannot be retried with the same `import('mfeChat/routes')`: the module that
 * `@module-federation/vite` generates for it keeps the first rejection, the runtime keeps one
 * loading promise per remote entry, and the browser never fetches a module URL again after it
 * failed. Registering the remote again with a new entry URL (`?retry=<attempt>`) gives both the
 * runtime and the browser a key they have not seen, so the entry is really fetched again.
 */
export async function reloadRemote(
  id: string,
  attempt: number,
  runtime: FederationRuntime | null = getInstance() as unknown as FederationRuntime | null,
): Promise<RemoteModule> {
  const alias = id.split('/')[0];
  const remote = runtime?.options.remotes.find((r) => r.alias === alias || r.name === alias);
  if (!runtime || !remote?.entry) throw new Error(`remote "${alias}" is not registered`);

  const entry = new URL(remote.entry);
  entry.searchParams.set('retry', String(attempt));
  runtime.registerRemotes([{ ...remote, entry: entry.href }], { force: true });

  const module = await runtime.loadRemote<RemoteModule>(id);
  if (!module) throw new Error(`remote "${alias}" has no module "${id}"`);
  return module;
}
