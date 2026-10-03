import { Alert, AlertDescription, AlertTitle, Button } from '@app/ui';
import { CircleAlert, RotateCw } from 'lucide-react';

export interface RemoteFallbackProps {
  scopeName: string;
  onRetry: () => void;
}

/**
 * Scoped error UI rendered by `RemoteErrorBoundary` when a federated remote
 * fails to load. Built only from design-system primitives (`@app/ui`), per
 * SPEC §3.4 / AC-18.
 */
export function RemoteFallback({ scopeName, onRetry }: RemoteFallbackProps) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <Alert variant="destructive" data-testid={`remote-fallback-${scopeName}`}>
        <CircleAlert />
        <AlertTitle>This section couldn&rsquo;t load</AlertTitle>
        <AlertDescription>
          <p>
            The &ldquo;{scopeName}&rdquo; section failed to load. The rest of the app is still
            available.
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
