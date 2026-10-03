import React, { useEffect } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import '../src/styles/globals.css';

// AC-16: dark-mode toolbar toggle so both the light and dark token sets defined in
// globals.css get exercised (and Axe-checked, per AC-20) from every story.
const WithTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? 'light';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="bg-background text-foreground p-4">
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
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Light/dark theme (AC-16)',
      defaultValue: 'light',
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
