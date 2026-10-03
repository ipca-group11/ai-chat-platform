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
 * Wraps a federated dynamic `import()` (e.g. `() => import('mfeChat/routes')`)
 * so that any rejection (network failure, missing remote, etc.) is normalized
 * into a `RemoteLoadError` tagged with `scopeName`, rather than an opaque
 * loader-specific error.
 */
export function loadRemote(scopeName: string, loader: RemoteLoader): RemoteLoader {
  return async () => {
    try {
      return await loader();
    } catch (cause) {
      throw new RemoteLoadError(scopeName, cause);
    }
  };
}
