import { afterEach, describe, expect, it, vi } from 'vitest';
import { REMOTE_LOAD_TIMEOUT_MS, RemoteLoadError, loadRemote } from './loadRemote';

const Component = () => null;

describe('loadRemote', () => {
  it('resolves with the module the loader returns', async () => {
    const module = { default: Component };
    await expect(loadRemote('chat', () => Promise.resolve(module))()).resolves.toBe(module);
  });

  it('does not call the loader until the returned function is called', () => {
    let calls = 0;
    const wrapped = loadRemote('chat', () => {
      calls += 1;
      return Promise.resolve({ default: Component });
    });
    expect(calls).toBe(0);
    void wrapped();
    expect(calls).toBe(1);
  });

  it('wraps a rejection in a RemoteLoadError tagged with the scope and the original cause', async () => {
    const cause = new Error('network down');

    const failure = loadRemote('chat', () => Promise.reject(cause))();

    await expect(failure).rejects.toBeInstanceOf(RemoteLoadError);
    await expect(failure).rejects.toMatchObject({
      name: 'RemoteLoadError',
      scopeName: 'chat',
      cause,
      message: 'Failed to load remote "chat": network down',
    });
  });

  it('describes a non-Error rejection with String()', async () => {
    const failure = loadRemote('auth', () => Promise.reject('404'))();
    await expect(failure).rejects.toMatchObject({
      scopeName: 'auth',
      cause: '404',
      message: 'Failed to load remote "auth": 404',
    });
  });

  it('also wraps a loader that throws synchronously inside the async function', async () => {
    const failure = loadRemote('settings', () => {
      throw new Error('bad entry');
    })();
    await expect(failure).rejects.toMatchObject({ scopeName: 'settings' });
  });
});

describe('loadRemote timeout (AICHAT-163)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is 15 seconds', () => {
    expect(REMOTE_LOAD_TIMEOUT_MS).toBe(15_000);
  });

  it('rejects with a RemoteLoadError when the remote never answers', async () => {
    vi.useFakeTimers();
    const failure = loadRemote('chat', () => new Promise(() => undefined))();
    let settled = false;
    failure.catch(() => undefined).finally(() => (settled = true));

    await vi.advanceTimersByTimeAsync(REMOTE_LOAD_TIMEOUT_MS - 1);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(failure).rejects.toMatchObject({
      name: 'RemoteLoadError',
      scopeName: 'chat',
      message: 'Failed to load remote "chat": no answer after 15000 ms',
    });
  });

  it('resolves a remote that answers in time and leaves no timer behind', async () => {
    vi.useFakeTimers();
    const module = { default: Component };
    const loading = loadRemote(
      'chat',
      () => new Promise((resolve) => setTimeout(() => resolve(module), REMOTE_LOAD_TIMEOUT_MS - 1)),
    )();

    await vi.advanceTimersByTimeAsync(REMOTE_LOAD_TIMEOUT_MS - 1);
    await expect(loading).resolves.toBe(module);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('RemoteLoadError', () => {
  it('is an Error, so error boundaries and logging treat it normally', () => {
    const error = new RemoteLoadError('chat', new Error('x'));
    expect(error).toBeInstanceOf(Error);
    expect(error.stack).toBeDefined();
  });
});
