import { afterEach, describe, expect, it } from 'vitest';
import type { HtmlTagDescriptor } from 'vite';
import moduleFederationConfig from '../../module-federation.config';
import { remotePreloadTags, remoteRoutes, type RemotesConfig } from '../../remote-preload';

/** AICHAT-238: index.html preconnects to the remotes and modulepreloads the remote of the opened page. */
const remotes = moduleFederationConfig.remotes as RemotesConfig;
const routes = remoteRoutes(remotes);
const tags = remotePreloadTags(routes);

/** Runs the inline script of the plugin for `pathname`; returns the modulepreload links it added. */
function runInlineScript(pathname: string): HTMLLinkElement[] {
  window.history.replaceState(null, '', pathname);
  const script = tags.find((tag) => tag.tag === 'script') as HtmlTagDescriptor;
  new Function(String(script.children))();
  return [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')];
}

describe('remote preload hints (AICHAT-238)', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    window.history.replaceState(null, '', '/');
  });

  it('has a route for every remote of the federation config', () => {
    expect(routes.map((route) => route.remote).sort()).toEqual(['mfeAuth', 'mfeChat', 'mfeSettings']);
  });

  it('preconnects once per remote origin, in CORS mode like the module imports', () => {
    const preconnects = tags.filter((tag) => tag.attrs?.['rel'] === 'preconnect');
    expect(preconnects.map((tag) => tag.attrs?.['href'])).toEqual([
      'http://localhost:5001',
      'http://localhost:5002',
      'http://localhost:5003',
    ]);
    expect(preconnects.every((tag) => tag.attrs?.['crossorigin'] === 'anonymous')).toBe(true);
  });

  it.each([
    ['/chats', 'mfeChat', 'http://localhost:5002/remoteEntry.js'],
    ['/chats/3f1c', 'mfeChat', 'http://localhost:5002/remoteEntry.js'],
    ['/', 'mfeChat', 'http://localhost:5002/remoteEntry.js'],
    ['/login', 'mfeAuth', 'http://localhost:5001/remoteEntry.js'],
    ['/register', 'mfeAuth', 'http://localhost:5001/remoteEntry.js'],
    ['/settings', 'mfeSettings', 'http://localhost:5003/remoteEntry.js'],
  ])('on %s it modulepreloads only %s', (pathname, remote, entry) => {
    const links = runInlineScript(pathname);
    expect(links).toHaveLength(1);
    expect(links[0]?.href).toBe(entry);
    expect(links[0]?.crossOrigin).toBe('anonymous');
    expect(links[0]?.dataset['mfRemote']).toBe(remote);
  });

  it('preloads nothing on a page that no remote renders', () => {
    expect(runInlineScript('/unknown/page/here')).toHaveLength(0);
  });

  it('skips remotes given as a string or without a route', () => {
    expect(remoteRoutes({ mfeAuth: 'mfeAuth@http://x/remoteEntry.js', other: { entry: 'http://y/remoteEntry.js' } })).toEqual(
      [],
    );
    expect(remoteRoutes(undefined)).toEqual([]);
  });
});
