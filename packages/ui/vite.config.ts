/// <reference types="vitest/config" />
import { coveragePreset } from '@platform/test-config';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Components with their own entry (`@app/ui/<name>`), kept out of the barrel. */
const componentEntries = ['avatar', 'dialog', 'dropdown-menu', 'select', 'tabs', 'toast', 'tooltip'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      // The barrel plus one entry per heavy component (AICHAT-239, see src/index.ts).
      entry: Object.fromEntries(
        ['index', ...componentEntries].map((name) => [name, resolve(__dirname, `src/${name}.ts`)]),
      ),
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      // Leave React and every runtime dependency to the consuming app's bundler: bundling
      // them here inlines CJS modules (e.g. Base UI's use-sync-external-store) that call
      // `require('react')`, which throws in the browser once React is external.
      external: (id) =>
        /^(react|react-dom|@base-ui\/react|lucide-react|class-variance-authority|clsx|tailwind-merge)(\/|$)/.test(id),
      output: {
        assetFileNames: (assetInfo) =>
          assetInfo.names?.some((name) => name.endsWith('.css'))
            ? 'styles.css'
            : (assetInfo.names?.[0] ?? 'assets/[name][extname]'),
      },
    },
  },
  test: {
    // Force the React/ReactDOM dev builds (which provide `act()`) regardless of any
    // ambient `NODE_ENV=production` in the host shell/CI environment.
    env: { NODE_ENV: 'test' },
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: coveragePreset({
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/index.ts', 'src/components/**/index.ts'],
    }),
  },
});
