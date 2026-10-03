import { createModuleFederationConfig } from '@module-federation/vite';

/**
 * Module Federation host configuration for the shell app.
 *
 * Remote conventions (see docs/pods/shell/PLAN.md, proposed for cross-pod alignment):
 *  - mfeAuth     -> apps/mfe-auth     (dev port 5001, exposes "./routes")
 *  - mfeChat     -> apps/mfe-chat     (dev port 5002, exposes "./routes")
 *  - mfeSettings -> apps/mfe-settings (dev port 5003, exposes "./routes")
 *
 * Remote entry URLs are read from Vite env vars so platform-foundation's
 * .env.example / Docker Compose can override them per environment.
 */
const authRemoteUrl = process.env.VITE_MFE_AUTH_URL ?? 'http://localhost:5001';
const chatRemoteUrl = process.env.VITE_MFE_CHAT_URL ?? 'http://localhost:5002';
const settingsRemoteUrl = process.env.VITE_MFE_SETTINGS_URL ?? 'http://localhost:5003';

export default createModuleFederationConfig({
  name: 'shell',
  filename: 'remoteEntry.js',
  remotes: {
    mfeAuth: {
      type: 'module',
      name: 'mfeAuth',
      entry: `${authRemoteUrl}/remoteEntry.js`,
      entryGlobalName: 'mfeAuth',
      shareScope: 'default',
    },
    mfeChat: {
      type: 'module',
      name: 'mfeChat',
      entry: `${chatRemoteUrl}/remoteEntry.js`,
      entryGlobalName: 'mfeChat',
      shareScope: 'default',
    },
    mfeSettings: {
      type: 'module',
      name: 'mfeSettings',
      entry: `${settingsRemoteUrl}/remoteEntry.js`,
      entryGlobalName: 'mfeSettings',
      shareScope: 'default',
    },
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
    '@tanstack/react-router': { singleton: true },
    '@tanstack/react-query': { singleton: true },
    // Design system (`packages/ui`), shared as a singleton per AC-24 so host and
    // remotes render the same shadcn/Base UI components.
    '@app/ui': { singleton: true, requiredVersion: false },
  },
});
