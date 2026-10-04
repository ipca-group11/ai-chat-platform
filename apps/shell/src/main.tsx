import '@app/ui/styles.css';
import '@app/ui/fonts.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initFaro } from './shared/observability';
import { initTheme } from './shared/theme';

// First, so errors thrown while the app (and its remotes) boot are captured too.
initFaro();
initTheme();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
