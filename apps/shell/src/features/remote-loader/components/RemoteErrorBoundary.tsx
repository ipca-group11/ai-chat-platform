import { Component, type ReactNode } from 'react';
import { RemoteFallback } from './RemoteFallback';

export interface RemoteErrorBoundaryProps {
  scopeName: string;
  children: ReactNode;
  /**
   * Called (in addition to clearing the error state) when the user clicks
   * "Retry" in the fallback UI. Callers that need a fresh module load (e.g.
   * `createRemoteRoute`, whose `React.lazy` caches a rejected import
   * forever) can use this to force a new load attempt.
   */
  onRetry?: () => void;
}

interface RemoteErrorBoundaryState {
  hasError: boolean;
}

/**
 * React error boundary scoped to a single federated remote (`scopeName`).
 *
 * On catch, it renders `RemoteFallback` in place of just that remote's
 * mount point — it does not unmount the rest of the app shell (nav, other
 * routes), satisfying AC-27/AC-28/AC-29 (per-remote failure isolation).
 */
export class RemoteErrorBoundary extends Component<RemoteErrorBoundaryProps, RemoteErrorBoundaryState> {
  state: RemoteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RemoteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(`[remote-loader] remote "${this.props.scopeName}" failed:`, error);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <RemoteFallback scopeName={this.props.scopeName} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
