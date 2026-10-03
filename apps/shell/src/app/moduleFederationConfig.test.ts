import { describe, expect, it } from 'vitest';
import moduleFederationConfig from '../../module-federation.config';

describe('AC-22: shell is a Module Federation host with remotes for every microfrontend', () => {
  it('AC-22: configures mfeAuth, mfeChat, and mfeSettings as ESM remotes loaded at runtime', () => {
    const remotes = moduleFederationConfig.remotes as Record<
      string,
      { type: string; entry: string }
    >;

    expect(Object.keys(remotes).sort()).toEqual(['mfeAuth', 'mfeChat', 'mfeSettings']);
    for (const [name, remote] of Object.entries(remotes)) {
      // `type: 'module'` means the remote entry is fetched and evaluated as
      // a native ES module at runtime (i.e. lazy-loaded), not bundled into
      // the host at build time.
      expect(remote.type).toBe('module');
      expect(remote.entry).toMatch(/remoteEntry\.js$/);
      expect(remote.entry).toContain(
        name === 'mfeAuth' ? '5001' : name === 'mfeChat' ? '5002' : '5003',
      );
    }
  });
});

describe('AC-24: React, TanStack Router/Query, and the design system are shared singletons', () => {
  it('AC-24: react and react-dom are shared as singletons', () => {
    const shared = moduleFederationConfig.shared as Record<string, { singleton?: boolean }>;

    expect(shared.react?.singleton).toBe(true);
    expect(shared['react-dom']?.singleton).toBe(true);
  });

  it('AC-24: @tanstack/react-router and @tanstack/react-query are shared as singletons', () => {
    const shared = moduleFederationConfig.shared as Record<string, { singleton?: boolean }>;

    expect(shared['@tanstack/react-router']?.singleton).toBe(true);
    expect(shared['@tanstack/react-query']?.singleton).toBe(true);
  });

  it('AC-24: the design system package is shared as a singleton across host and remotes', () => {
    const shared = moduleFederationConfig.shared as Record<string, { singleton?: boolean }>;
    // The design system is expected to be shared under its workspace
    // package name (e.g. `@app/ui`) once `packages/ui` is wired in, per
    // AC-24 and `docs/pods/shell/PLAN.md`'s FE-1 task.
    const designSystemEntry = Object.entries(shared).find(([name]) => /ui/i.test(name));

    expect(designSystemEntry, 'expected a design-system package entry in `shared`').toBeDefined();
    expect(designSystemEntry?.[1]?.singleton).toBe(true);
  });
});
