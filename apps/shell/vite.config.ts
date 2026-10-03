import { coveragePreset, appCoverageThresholds } from '@platform/test-config';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { federation } from '@module-federation/vite';
import moduleFederationConfig from './module-federation.config';

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
      },
    },
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    federation(moduleFederationConfig),
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
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Cold-cache transform of module-federation.config.ts (and its
    // @module-federation/vite import) can exceed the 5s default, especially
    // in sandboxed/CI environments without a warm Vite cache; give tests
    // that dynamically import it (e.g. remoteWiring.test.ts) headroom.
    testTimeout: 15000,
    coverage: coveragePreset({
      thresholds: {
        ...appCoverageThresholds,
        // Ratchet (AICHAT-34): current values rounded down, raised with AICHAT-17/18 work.
        lines: 70, // TODO(AICHAT-17, 2026-10-03): raise to 80
        branches: 60, // TODO(AICHAT-17, 2026-10-03): raise to 75
        functions: 62, // TODO(AICHAT-17, 2026-10-03): raise to 80
        statements: 68, // TODO(AICHAT-17, 2026-10-03): raise to 80
      },
    }),
  },
});
