import { describe, expect, it } from 'vitest';
// Vite's `?raw` import suffix (typed via the `vite/client` reference in
// `vite-env.d.ts`) loads each route file's source as a plain string, so we
// can assert on its wiring without going through TanStack Router's
// auto-code-splitting transform (see note below).
import loginSource from '../routes/login.tsx?raw';
import chatsSource from '../routes/chats.tsx?raw';
import chatsChatIdSource from '../routes/chats.$chatId.tsx?raw';
import settingsSource from '../routes/settings.tsx?raw';

/**
 * AC-22: "The shell app is a Vite Module Federation host that lazy-loads
 * mfe-auth, mfe-chat, and mfe-settings as remotes at runtime."
 *
 * The actual dynamic `import('mfeXxx/routes')` calls live inside route files
 * that TanStack Router's Vite plugin auto-code-splits (`?tsr-split=component`)
 * at build time, which requires the full Vite dev/build pipeline and can't be
 * exercised by importing the module directly in a unit test (the bare
 * `mfeAuth/routes` specifier is only resolvable via the Module Federation
 * runtime, see `module-federation.config.ts`). `RemoteErrorBoundary.test.tsx`
 * already exercises `createRemoteRoute`'s runtime lazy-loading/Suspense/error
 * -boundary behavior against mocked loaders (AC-27/AC-28/AC-29); this test
 * verifies each route actually wires `createRemoteRoute` to the correct
 * federated remote module for lazy-loading at runtime, and that each of
 * those remotes is declared in the Module Federation host config.
 */
describe('AC-22: shell routes lazy-load mfe-auth, mfe-chat, and mfe-settings as remotes', () => {
  it("AC-22: /login lazy-loads the mfeAuth remote via createRemoteRoute(() => import('mfeAuth/routes'))", () => {
    expect(loginSource).toMatch(/createRemoteRoute\(\s*['"]auth['"]/);
    expect(loginSource).toMatch(/import\(\s*['"]mfeAuth\/routes['"]\s*\)/);
  });

  it("AC-22: /chats lazy-loads the mfeChat remote via createRemoteRoute(() => import('mfeChat/routes'))", () => {
    expect(chatsSource).toMatch(/createRemoteRoute\(\s*['"]chat['"]/);
    expect(chatsSource).toMatch(/import\(\s*['"]mfeChat\/routes['"]\s*\)/);
  });

  it("AC-22: /chats/$chatId lazy-loads the mfeChat remote via createRemoteRoute(() => import('mfeChat/routes'))", () => {
    expect(chatsChatIdSource).toMatch(/createRemoteRoute\(\s*['"]chat['"]/);
    expect(chatsChatIdSource).toMatch(/import\(\s*['"]mfeChat\/routes['"]\s*\)/);
  });

  it("AC-22: /settings lazy-loads the mfeSettings remote via createRemoteRoute(() => import('mfeSettings/routes'))", () => {
    expect(settingsSource).toMatch(/createRemoteRoute\(\s*['"]settings['"]/);
    expect(settingsSource).toMatch(/import\(\s*['"]mfeSettings\/routes['"]\s*\)/);
  });

  it('AC-22: each remote module referenced by the routes is declared in the Module Federation host config', async () => {
    const { default: moduleFederationConfig } = await import('../../module-federation.config');
    const remotes = moduleFederationConfig.remotes as Record<string, unknown>;

    expect(Object.keys(remotes).sort()).toEqual(['mfeAuth', 'mfeChat', 'mfeSettings']);
  });
});
