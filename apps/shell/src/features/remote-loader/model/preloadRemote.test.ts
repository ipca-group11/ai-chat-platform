import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadCurrentRemote } from './preloadRemote';

function addPreloadLink(remote: string) {
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.dataset['mfRemote'] = remote;
  document.head.appendChild(link);
}

describe('preloadCurrentRemote (AICHAT-238)', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('starts the import of the remote tagged by index.html, and only that one', () => {
    addPreloadLink('mfeChat');
    const imports = { mfeAuth: vi.fn(async () => ({})), mfeChat: vi.fn(async () => ({})) };

    expect(preloadCurrentRemote(imports)).toBe('mfeChat');
    expect(imports.mfeChat).toHaveBeenCalledOnce();
    expect(imports.mfeAuth).not.toHaveBeenCalled();
  });

  it('does nothing without a tagged link or for an unknown remote', () => {
    const imports = { mfeChat: vi.fn(async () => ({})) };
    expect(preloadCurrentRemote(imports)).toBeUndefined();

    addPreloadLink('mfeOther');
    expect(preloadCurrentRemote(imports)).toBeUndefined();
    expect(imports.mfeChat).not.toHaveBeenCalled();
  });

  it('swallows a failed preload, so the route can load and show its own fallback', async () => {
    addPreloadLink('mfeChat');
    const failing = vi.fn(() => Promise.reject(new Error('remote down')));

    expect(preloadCurrentRemote({ mfeChat: failing })).toBe('mfeChat');
    await expect(failing.mock.results[0]?.value).rejects.toThrow('remote down');
  });
});
