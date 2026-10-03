import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const dirname = fileURLToPath(new URL('.', import.meta.url));

// Storybook config for @app/ui (AC-21: `nx run ui:storybook` builds/serves this).
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
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
    };
    return viteConfig;
  },
  docs: {
    autodocs: true,
  },
};

export default config;
