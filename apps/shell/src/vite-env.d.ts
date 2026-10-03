/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MFE_AUTH_URL?: string;
  readonly VITE_MFE_CHAT_URL?: string;
  readonly VITE_MFE_SETTINGS_URL?: string;
  /** Grafana Alloy faro.receiver endpoint; Faro is off when unset. */
  readonly VITE_FARO_URL?: string;
  /** Build identifier (commit SHA) reported with every Faro signal. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'mfeAuth/routes' {
  import type { ComponentType } from 'react';
  const Routes: ComponentType;
  export default Routes;
}

declare module 'mfeChat/routes' {
  import type { ComponentType } from 'react';
  const Routes: ComponentType;
  export default Routes;
}

declare module 'mfeSettings/routes' {
  import type { ComponentType } from 'react';
  const Routes: ComponentType;
  export default Routes;
}
