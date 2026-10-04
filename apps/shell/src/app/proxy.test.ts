// @vitest-environment node
// (vite.config.ts resolves paths from import.meta.url, which is only a file: URL under node.)
import { describe, expect, it } from 'vitest';
import type { ProxyOptions } from 'vite';
import config, { isPrivateApiPath } from '../../vite.config';

/** The `/api` proxy of the dev server and of `vite preview` (the Docker/production shell). */
const apiProxies = [config.server?.proxy, config.preview?.proxy].map(
  (proxy) => (proxy as Record<string, ProxyOptions>)['/api'],
);

function forwards(proxy: ProxyOptions | undefined, url: string): boolean {
  const bypass = proxy?.bypass as ((req: { url: string }) => unknown) | undefined;
  return bypass?.({ url }) !== false;
}

describe('shell /api proxy keeps service-only routes private', () => {
  it.each(['/api/metrics', '/api/metrics?x=1', '/api/METRICS', '/api//metrics', '/api/%6detrics'])(
    'rejects %s (AICHAT-229)',
    (url) => {
      for (const proxy of apiProxies) expect(forwards(proxy, url)).toBe(false);
    },
  );

  it.each([
    '/api/internal',
    '/api/internal/erasures',
    '/api/internal/erasures?x=1',
    '/api/Internal/Erasures',
    '/api//internal/erasures',
    '/api/%69nternal/erasures',
  ])('rejects %s (AICHAT-248)', (url) => {
    for (const proxy of apiProxies) expect(forwards(proxy, url)).toBe(false);
  });

  it.each(['/api/chats', '/api/chats/1/messages?after=2', '/api/models', '/api/internalize'])('forwards %s', (url) => {
    for (const proxy of apiProxies) expect(forwards(proxy, url)).toBe(true);
  });

  it('rejects a path it cannot decode rather than guessing', () => {
    expect(isPrivateApiPath('/api/%E0%A4%A')).toBe(true);
  });
});
