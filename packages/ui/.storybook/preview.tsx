import React, { useEffect } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import '../src/styles/globals.css';
import '../src/styles/fonts.css';

// Start in the same theme the app would pick (apps/shell/src/shared/theme): the OS
// preference, until the toolbar overrides it.
const systemTheme =
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

// AC-16: dark-mode toolbar toggle so both the light and dark token sets defined in
// globals.css get exercised (and Axe-checked, per AC-20) from every story.
const WithTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? systemTheme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Storybook's own layout already pads the canvas; full-page stories (`layout: 'fullscreen'`)
  // fill the viewport like the app does.
  const fullscreen = context.parameters.layout === 'fullscreen';
  return (
    <div className={fullscreen ? 'min-h-svh bg-background text-foreground' : 'bg-background text-foreground'}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // AC-20: Axe addon enabled globally; individual stories may extend/override via
    // `parameters.a11y.config`.
    a11y: {
      test: 'error',
    },
    backgrounds: { disable: true },
  },
  initialGlobals: {
    theme: systemTheme,
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Light/dark theme (AC-16)',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [WithTheme],
};

export default preview;
