import { describe, expect, it, vi } from 'vitest';
import { reloadRemote, type FederationRuntime } from './reloadRemote';

const Component = () => null;

function fakeRuntime(module: unknown = { default: Component }) {
  const runtime = {
    options: {
      remotes: [
        { name: '__mfe_internal__shell__mfeChat', alias: 'mfeChat', entry: 'http://localhost:3002/remoteEntry.js' },
        { name: 'mfeSettings', entry: 'http://localhost:3003/remoteEntry.js' },
      ],
    },
    registerRemotes: vi.fn(),
    loadRemote: vi.fn(() => Promise.resolve(module)),
  };
  return runtime as typeof runtime & FederationRuntime;
}

describe('reloadRemote (AICHAT-164)', () => {
  it('registers the remote again under a new entry URL, then loads the module', async () => {
    const runtime = fakeRuntime();

    const module = await reloadRemote('mfeChat/routes', 2, runtime);

    expect(runtime.registerRemotes).toHaveBeenCalledWith(
      [
        {
          name: '__mfe_internal__shell__mfeChat',
          alias: 'mfeChat',
          entry: 'http://localhost:3002/remoteEntry.js?retry=2',
        },
      ],
      { force: true },
    );
    expect(runtime.loadRemote).toHaveBeenCalledWith('mfeChat/routes');
    expect(runtime.registerRemotes.mock.invocationCallOrder[0]).toBeLessThan(
      runtime.loadRemote.mock.invocationCallOrder[0]!,
    );
    expect(module).toEqual({ default: Component });
  });

  it('finds a remote by its name when it has no alias', async () => {
    const runtime = fakeRuntime();
    await reloadRemote('mfeSettings/routes', 1, runtime);
    expect(runtime.registerRemotes.mock.calls[0]?.[0]).toEqual([
      { name: 'mfeSettings', entry: 'http://localhost:3003/remoteEntry.js?retry=1' },
    ]);
  });

  it('fails, so the fallback stays, when the remote is unknown or there is no runtime', async () => {
    await expect(reloadRemote('mfeAuth/routes', 1, fakeRuntime())).rejects.toThrow('remote "mfeAuth" is not registered');
    await expect(reloadRemote('mfeAuth/routes', 1, null)).rejects.toThrow('is not registered');
  });

  it('fails when the remote does not expose the module', async () => {
    await expect(reloadRemote('mfeChat/routes', 1, fakeRuntime(null))).rejects.toThrow(
      'remote "mfeChat" has no module "mfeChat/routes"',
    );
  });

  it('passes the load error on, so the fallback is shown again', async () => {
    const runtime = fakeRuntime();
    runtime.loadRemote.mockRejectedValueOnce(new Error('RUNTIME-008'));
    await expect(reloadRemote('mfeChat/routes', 1, runtime)).rejects.toThrow('RUNTIME-008');
  });
});
