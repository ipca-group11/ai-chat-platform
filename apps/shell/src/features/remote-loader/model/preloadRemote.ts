/** Federated imports of each remote's routes module, keyed by remote alias (`mfeChat`, ...). */
export type RemoteImports = Record<string, () => Promise<unknown>>;

/**
 * Starts the federated import of the remote that renders the current page, before React mounts
 * (AICHAT-238). `index.html` already added a `modulepreload` for that remote's `remoteEntry.js`
 * (see `remote-preload.ts`) and tagged it with `data-mf-remote`; this reads the tag, so the route
 * table lives in one place. Without it the remote is only requested after the session check of
 * `RequireAuth`; now it downloads in parallel. The route's own lazy import reuses the result.
 *
 * Returns the alias of the remote it started, if any.
 */
export function preloadCurrentRemote(imports: RemoteImports, doc: Document = document): string | undefined {
  const remote = doc.querySelector<HTMLLinkElement>('link[data-mf-remote]')?.dataset['mfRemote'];
  const load = remote ? imports[remote] : undefined;
  if (!remote || !load) return undefined;
  // A failure is not reported here: the route loads the remote again and shows its fallback.
  load().catch(() => undefined);
  return remote;
}
