import type { ComponentType } from 'react';

/**
 * Error thrown when a federated remote fails to load, tagged with the
 * `scopeName` that failed so `RemoteErrorBoundary` can render a fallback
 * scoped to just that part of the UI (AC-27/AC-28) instead of crashing the
 * whole shell.
 */
export class RemoteLoadError extends Error {
  readonly scopeName: string;
  readonly cause?: unknown;

  constructor(scopeName: string, cause: unknown) {
    super(
      `Failed to load remote "${scopeName}": ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'RemoteLoadError';
    this.scopeName = scopeName;
    this.cause = cause;
  }
}

export type RemoteLoader = () => Promise<{ default: ComponentType }>;

/**
 * How long a remote may take to load before the shell shows its fallback.
 * A remote that never answers would otherwise keep the loading skeleton
 * forever, with no Retry (AICHAT-163).
 */
export const REMOTE_LOAD_TIMEOUT_MS = 15_000;

/**
 * Wraps a federated dynamic `import()` (e.g. `() => import('mfeChat/routes')`)
 * so that any rejection (network failure, missing remote, etc.) or no answer
 * within `REMOTE_LOAD_TIMEOUT_MS` is normalized into a `RemoteLoadError`
 * tagged with `scopeName`, rather than an opaque loader-specific error.
 */
export function loadRemote(scopeName: string, loader: RemoteLoader): RemoteLoader {
  return async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`no answer after ${REMOTE_LOAD_TIMEOUT_MS} ms`)),
        REMOTE_LOAD_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([loader(), timeout]);
    } catch (cause) {
      throw new RemoteLoadError(scopeName, cause);
    } finally {
      clearTimeout(timer);
    }
  };
}
