// Public API of the `remote-loader` feature (per docs/pods/shell/PLAN.md).
export { createRemoteRoute } from './createRemoteRoute';
export { RemoteErrorBoundary } from './components/RemoteErrorBoundary';
export type { RemoteErrorBoundaryProps } from './components/RemoteErrorBoundary';
export { RemoteLoadError, loadRemote } from './model/loadRemote';
export type { RemoteLoader } from './model/loadRemote';
export { preloadCurrentRemote } from './model/preloadRemote';
export type { RemoteImports } from './model/preloadRemote';
