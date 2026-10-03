import { afterEach, describe, expect, it, vi } from 'vitest';

const initializeFaro = vi.fn(() => ({}) as never);
vi.mock('@grafana/faro-web-sdk', () => ({
  initializeFaro,
  getWebInstrumentations: vi.fn(() => []),
  LogLevel: { TRACE: 'trace', DEBUG: 'debug', LOG: 'log', INFO: 'info', WARN: 'warn', ERROR: 'error' },
}));

const { initFaro, FARO_APP_NAME } = await import('./faro');
const { scrubTransportItem } = await import('./faro-scrub');

describe('initFaro', () => {
  afterEach(() => initializeFaro.mockClear());

  it('stays off when no collector URL is configured', () => {
    expect(initFaro({ url: undefined })).toBeNull();
    expect(initializeFaro).not.toHaveBeenCalled();
  });

  it('starts Faro against the configured collector with the app identity', () => {
    initFaro({ url: 'https://example.test/collect', version: 'abc123', environment: 'production' });
    expect(initializeFaro).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.test/collect',
        app: { name: FARO_APP_NAME, version: 'abc123', environment: 'production' },
      }),
    );
  });

  it('falls back to a dev version when none is baked in', () => {
    initFaro({ url: 'https://example.test/collect' });
    expect(initializeFaro).toHaveBeenCalledWith(
      expect.objectContaining({ app: expect.objectContaining({ version: 'dev' }) }),
    );
  });

  it('scrubs every item before it is sent and captures only warnings and errors from the console', () => {
    initFaro({ url: 'https://example.test/collect' });
    expect(initializeFaro).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeSend: scrubTransportItem,
        consoleInstrumentation: { disabledLevels: ['trace', 'debug', 'log', 'info'] },
      }),
    );
  });
});
