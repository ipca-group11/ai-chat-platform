import { describe, expect, it } from 'vitest';
import { RemoteLoadError, loadRemote } from './loadRemote';

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

describe('RemoteLoadError', () => {
  it('is an Error, so error boundaries and logging treat it normally', () => {
    const error = new RemoteLoadError('chat', new Error('x'));
    expect(error).toBeInstanceOf(Error);
    expect(error.stack).toBeDefined();
  });
});
