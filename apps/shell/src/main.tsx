import '@app/ui/styles.css';
import '@app/ui/fonts.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { preloadCurrentRemote } from './features/remote-loader';
import { initFaro } from './shared/observability';
import { initTheme } from './shared/theme';

// First, so errors thrown while the app (and its remotes) boot are captured too.
initFaro();
initTheme();

// AICHAT-238: start loading the remote of this page now, in parallel with React and the session check.
preloadCurrentRemote({
  mfeAuth: () => import('mfeAuth/routes'),
  mfeChat: () => import('mfeChat/routes'),
  mfeSettings: () => import('mfeSettings/routes'),
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
