import { getWebInstrumentations, initializeFaro, type Faro } from '@grafana/faro-web-sdk';

/**
 * Grafana Faro real-user monitoring for the whole app. The shell is the only page the
 * browser loads (the remotes run inside it), so initializing here also covers errors,
 * logs and web vitals from mfe-auth/mfe-chat/mfe-settings.
 *
 * Data is posted to `VITE_FARO_URL` (Grafana Alloy's faro.receiver, which stores it in
 * Loki). Without that build-time URL (local dev, tests) Faro stays off.
 */
export const FARO_APP_NAME = 'llm-chat';

export interface FaroConfig {
  url?: string;
  version?: string;
  environment?: string;
}

export function initFaro(config: FaroConfig = readConfig()): Faro | null {
  if (!config.url) return null;
  return initializeFaro({
    url: config.url,
    app: {
      name: FARO_APP_NAME,
      version: config.version || 'dev',
      environment: config.environment || 'production',
    },
    instrumentations: getWebInstrumentations({ captureConsole: true }),
  });
}

function readConfig(): FaroConfig {
  return {
    url: import.meta.env.VITE_FARO_URL,
    version: import.meta.env.VITE_APP_VERSION,
    environment: import.meta.env.MODE,
  };
}
