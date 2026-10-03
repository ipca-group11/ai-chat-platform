import { Suspense, lazy, useMemo, useState, type ComponentType } from 'react';
import { Skeleton } from '@app/ui';
import { RemoteErrorBoundary } from './components/RemoteErrorBoundary';
import { loadRemote, type RemoteLoader } from './model/loadRemote';

function RemoteLoadingFallback({ scopeName }: { scopeName: string }) {
  return (
    <div data-testid={`remote-loading-${scopeName}`} className="mx-auto w-full max-w-3xl space-y-3 px-4 py-10">
      <span className="sr-only">Loading {scopeName}…</span>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

/**
 * Combines `loadRemote` + `Suspense` + `RemoteErrorBoundary` into a single
 * component for mounting a federated remote's route module.
 *
 * Usage: `createRemoteRoute('chat', () => import('mfeChat/routes'))`.
 *
 * On retry (triggered from `RemoteErrorBoundary`'s fallback UI), a fresh
 * `React.lazy` is created so the failed import is actually re-attempted
 * (`React.lazy` otherwise caches a rejected load forever for its lifetime).
 */
export function createRemoteRoute(scopeName: string, loader: RemoteLoader): ComponentType {
  function RemoteRoute() {
    const [retryKey, setRetryKey] = useState(0);

    // Intentionally re-creating the lazy component (a new component
    // definition) whenever `retryKey` changes: `React.lazy` caches a
    // rejected import forever, so a fresh lazy wrapper is the only way to
    // actually re-attempt a failed remote load on retry. `scopeName`/`loader`
    // are stable for a given `createRemoteRoute` call.
    const LazyRemote = useMemo(
      () => lazy(loadRemote(scopeName, loader)),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [retryKey],
    );

    return (
      <RemoteErrorBoundary scopeName={scopeName} onRetry={() => setRetryKey((key) => key + 1)}>
        <Suspense fallback={<RemoteLoadingFallback scopeName={scopeName} />}>
          {/* eslint-disable-next-line react-hooks/static-components -- see comment above: retryKey intentionally forces a fresh lazy component to retry the failed import */}
          <LazyRemote />
        </Suspense>
      </RemoteErrorBoundary>
    );
  }

  RemoteRoute.displayName = `RemoteRoute(${scopeName})`;
  return RemoteRoute;
}
