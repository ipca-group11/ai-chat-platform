import { coveragePreset, appCoverageThresholds } from '@platform/test-config';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { federation } from '@module-federation/vite';
import moduleFederationConfig from './module-federation.config';
import { remotePreload } from './remote-preload';

/**
 * conversation-service routes the `/api` proxy must not forward: its Prometheus metrics
 * (AICHAT-229) and the service-to-service `/internal` API that only auth-service calls
 * (AICHAT-248). Compared on the decoded, lower-cased path with repeated slashes merged,
 * because Express matches routes case-insensitively. deploy/azure/Caddyfile blocks the
 * same paths in production.
 */
const privateApiPaths = [/^\/api\/metrics/, /^\/api\/internal(\/|$)/];

export function isPrivateApiPath(url: string): boolean {
  let path = url.split(/[?#]/)[0] ?? '';
  try {
    path = decodeURIComponent(path);
  } catch {
    return true;
  }
  path = path.replace(/\/{2,}/g, '/').toLowerCase();
  return privateApiPaths.some((pattern) => pattern.test(path));
}

/** Vite's proxy answers 404 instead of forwarding when `bypass` returns `false`. */
export function blockPrivateApiPaths(req: { url?: string }): false | undefined {
  return isPrivateApiPath(req.url ?? '') ? false : undefined;
}

export default defineConfig({
  cacheDir: '../../node_modules/.vite/apps/shell',
  server: {
    port: 5000,
    host: 'localhost',
    // Local dev without Docker (scripts/dev.sh): same same-origin proxies as `preview`,
    // pointed at the services running natively on localhost.
    proxy: {
      '/auth': {
        target: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4001',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.CONVERSATION_SERVICE_URL ?? 'http://localhost:4002',
        changeOrigin: true,
        rewrite: (proxyPath: string) => proxyPath.replace(/^\/api/, ''),
        bypass: blockPrivateApiPaths,
      },
    },
  },
  preview: {
    port: 5000,
    host: 'localhost',
    // Same-origin `/api` proxy to `services/conversation-service` (Docker deploy):
    // `apps/mfe-chat`'s API client defaults to a same-origin `/api` path when no
    // runtime override is injected (see apps/mfe-chat/src/shared/api-client.ts), and
    // conversation-service itself mounts routes at its root (`/chats`, ...), so the
    // `/api` prefix is stripped before forwarding. Target defaults to the Docker
    // Compose service DNS name; override with CONVERSATION_SERVICE_URL for other
    // environments (see docs/DEPLOY.md).
    proxy: {
      // Session checks (`/auth/me`, refresh, logout) go to auth-service on the same origin,
      // so the httpOnly cookies set by /auth/login are sent with them.
      '/auth': {
        target: process.env.AUTH_SERVICE_URL ?? 'http://auth-service:4001',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.CONVERSATION_SERVICE_URL ?? 'http://conversation-service:4002',
        changeOrigin: true,
        rewrite: (proxyPath: string) => proxyPath.replace(/^\/api/, ''),
        bypass: blockPrivateApiPaths,
      },
    },
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      // Unit tests live next to the route files and must not become routes.
      routeFileIgnorePattern: '\\.test\\.',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    federation(moduleFederationConfig),
    // AICHAT-238: preconnect to the remotes and modulepreload the remoteEntry.js of the opened page.
    remotePreload(moduleFederationConfig.remotes),
  ],
  build: {
    target: 'esnext',
    modulePreload: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Force a non-"production" NODE_ENV for the test run. React/ReactDOM only export
    // test-only APIs (e.g. `React.act`, used by @testing-library/react) from their
    // development builds; if the host shell exports NODE_ENV=production, Vite/Node
    // resolve react's production build instead and `render()` blows up with
    // "React.act is not a function". Vitest's `test.env` sets process.env for the
    // test run, independent of whatever NODE_ENV the invoking shell has set.
    env: {
      NODE_ENV: 'test',
    },
    setupFiles: ['./src/test-setup.ts', '@platform/test-utils/setup'],
    // The page stories (src/app/pages.stories.tsx) mount the remotes' routes; for their DOM
    // snapshots the federated names point at the remotes' source, as in Storybook
    // (packages/ui/.storybook/main.ts). Nothing else in the shell's tests imports them.
    alias: {
      'mfeAuth/routes': fileURLToPath(new URL('../mfe-auth/src/routes.tsx', import.meta.url)),
      'mfeChat/routes': fileURLToPath(new URL('../mfe-chat/src/app/routes.tsx', import.meta.url)),
      'mfeSettings/routes': fileURLToPath(new URL('../mfe-settings/src/routes.tsx', import.meta.url)),
      '@app/shared-types/model-capabilities': fileURLToPath(
        new URL('../../packages/shared-types/src/model-capabilities.ts', import.meta.url),
      ),
      '@app/shared-types/api-keys': fileURLToPath(
        new URL('../../packages/shared-types/src/api-keys/index.ts', import.meta.url),
      ),
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Cold-cache transform of module-federation.config.ts (and its
    // @module-federation/vite import) can exceed the 5s default, especially
    // in sandboxed/CI environments without a warm Vite cache; give tests
    // that dynamically import it (e.g. remoteWiring.test.ts) headroom.
    testTimeout: 15000,
    coverage: coveragePreset({
      exclude: ['src/shared/test/**'],
      // Standard thresholds (AICHAT-34 ratchet closed by AICHAT-17: 80/75/80/80).
      thresholds: appCoverageThresholds,
    }),
  },
});
