import type { HtmlTagDescriptor, Plugin } from 'vite';

/**
 * Preload hints for the micro-frontend of the page being opened (AICHAT-238).
 *
 * Without them the browser finds the remote late: HTML -> shell bootstrap -> shell runtime ->
 * React -> session check -> remote `remoteEntry.js` -> remote route chunk, one after another.
 * This plugin adds to `index.html`:
 *  - a `preconnect` per remote origin, so the connection is open before the first request;
 *  - a tiny inline script that matches `location.pathname` against the routes below and adds a
 *    `modulepreload` for that remote's `remoteEntry.js`, so it downloads while the shell boots.
 *    The `<link>` carries `data-mf-remote` with the remote name; `src/main.tsx` reads it and
 *    starts the federated import of that remote's routes before React mounts.
 */

export interface RemoteRoute {
  /** Remote alias in `module-federation.config.ts` (`mfeChat`, ...). */
  remote: string;
  /** `remoteEntry.js` URL of the remote. */
  entry: string;
  /** Source of a RegExp tested against `location.pathname`. */
  pathPattern: string;
}

/** Which remote renders which shell route (see `src/routes/*.tsx`; `/` redirects to `/chats`). */
export const REMOTE_PATH_PATTERNS: Record<string, string> = {
  mfeAuth: '^/(login|register)/?$',
  mfeChat: '^/(chats(/[^/]+)?)?/?$',
  mfeSettings: '^/settings/?$',
};

/** Remotes as `module-federation.config.ts` declares them (object form; the string form is skipped). */
export type RemotesConfig = Record<string, string | { entry: string }> | undefined;

/** The routes of the remotes that have a path pattern, with their entry URL. */
export function remoteRoutes(remotes: RemotesConfig): RemoteRoute[] {
  return Object.entries(remotes ?? {}).flatMap(([remote, config]) => {
    const pathPattern = REMOTE_PATH_PATTERNS[remote];
    return pathPattern && typeof config === 'object' ? [{ remote, entry: config.entry, pathPattern }] : [];
  });
}

/** `<head>` tags: one preconnect per remote origin and the inline modulepreload script. */
export function remotePreloadTags(routes: RemoteRoute[]): HtmlTagDescriptor[] {
  const origins = [...new Set(routes.map((route) => new URL(route.entry).origin))];
  const table = JSON.stringify(routes.map((route) => [route.pathPattern, route.entry, route.remote]));
  const script =
    `(function(){var r=${table};for(var i=0;i<r.length;i++){if(new RegExp(r[i][0]).test(location.pathname)){` +
    `var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='anonymous';l.href=r[i][1];` +
    `l.setAttribute('data-mf-remote',r[i][2]);document.head.appendChild(l);break;}}})();`;
  return [
    ...origins.map(
      (href): HtmlTagDescriptor => ({
        tag: 'link',
        attrs: { rel: 'preconnect', href, crossorigin: 'anonymous' },
        injectTo: 'head',
      }),
    ),
    { tag: 'script', children: script, injectTo: 'head' },
  ];
}

export function remotePreload(remotes: RemotesConfig): Plugin {
  const routes = remoteRoutes(remotes);
  return {
    name: 'shell-remote-preload',
    transformIndexHtml: () => remotePreloadTags(routes),
  };
}
