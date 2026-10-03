/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.stories.tsx',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/index.ts',
        'src/components/**/index.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
