import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(dirname, '../../..');

// Storybook config for @app/ui (AC-21: `nx run ui:storybook` builds/serves this).
// Besides the design-system primitives it also collects the app-level stories that live
// next to their components in the microfrontends, so the catalogue shows the real UI.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)', '../../../apps/*/src/**/*.stories.@(ts|tsx)'],
  addons: [
    // AC-20: Axe accessibility checks, enabled globally (see preview.tsx), reported
    // per-story in the "Accessibility" panel.
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (viteConfig) => {
    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = {
      ...(viteConfig.resolve.alias ?? {}),
      '@': resolve(dirname, '../src'),
      // App stories read the design system from source (not the built dist), so they always
      // render against the same components and tokens as the primitive stories. The
      // per-component entries (`@app/ui/dialog`, ..., AICHAT-239) come first: `@app/ui` would
      // otherwise match them as a prefix.
      ...Object.fromEntries(
        ['avatar', 'dialog', 'dropdown-menu', 'select', 'tabs', 'toast', 'tooltip'].map((name) => [
          `@app/ui/${name}`,
          resolve(dirname, `../src/${name}.ts`),
        ]),
      ),
      '@app/ui': resolve(dirname, '../src/index.ts'),
      // Same source aliases the microfrontends declare in their own vite configs.
      '@app/shared-types/model-capabilities': resolve(repoRoot, 'packages/shared-types/src/model-capabilities.ts'),
      '@app/shared-types/api-keys': resolve(repoRoot, 'packages/shared-types/src/api-keys/index.ts'),
      '@app/shared-types': resolve(repoRoot, 'packages/shared-types/src/index.ts'),
      // The shell loads its pages from the microfrontends over Module Federation at runtime;
      // in Storybook the same import names point at their source, so page stories render
      // the real shell with the real pages inside it.
      'mfeAuth/routes': resolve(repoRoot, 'apps/mfe-auth/src/routes.tsx'),
      'mfeChat/routes': resolve(repoRoot, 'apps/mfe-chat/src/app/routes.tsx'),
      'mfeSettings/routes': resolve(repoRoot, 'apps/mfe-settings/src/routes.tsx'),
    };
    // Apps and the design system resolve these from different node_modules folders; keep a
    // single copy so hooks and contexts are shared.
    viteConfig.resolve.dedupe = [
      ...(viteConfig.resolve.dedupe ?? []),
      'react',
      'react-dom',
      '@tanstack/react-query',
      '@tanstack/react-router',
    ];
    return viteConfig;
  },
  docs: {
    autodocs: true,
  },
};

export default config;
