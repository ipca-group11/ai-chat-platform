/**
 * AICHAT-136: what the shell's Faro setup sends to the collector carries no PII. Runs the real
 * `initFaro` with the real SDK, replaces `fetch` with a recorder, pushes logs, errors, events and
 * measurements that carry fake PII, and runs the shared detector over every `/collect` body.
 * (The Playwright capture planned for this check is replaced by this test: the e2e suite is off.)
 */
import { LogLevel } from '@grafana/faro-web-sdk';
import { describePii, findPii } from '@platform/test-utils/pii';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initFaro } from './faro';

const CANARY = 'PII-CANARY-7f3a';
const EMAIL = 'ana.faro@pii-canary.example.com';
const IP = '203.0.113.77';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl';
const canaries = [CANARY, EMAIL, IP, JWT];

const bodies: string[] = [];

beforeAll(async () => {
  for (const level of ['error', 'warn', 'info', 'log', 'debug'] as const) vi.spyOn(console, level).mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: { body?: unknown }) => {
      if (String(url).endsWith('/collect')) bodies.push(String(init?.body));
      return new Response(null, { status: 202 });
    }),
  );
  // A page URL that carries an email and a canary in the query string and the fragment.
  window.history.replaceState({}, '', `/chats/c1?email=${EMAIL}&note=${CANARY}#${CANARY}`);

  const faro = initFaro({ url: 'https://faro.example.test/collect', version: 'test', environment: 'test' });
  if (!faro) throw new Error('Faro did not start');

  faro.api.setUser({ id: 'user-1', email: EMAIL, username: 'ana', attributes: { phone: IP } });
  faro.api.pushLog([`request failed for ${EMAIL} from ${IP}`], { level: LogLevel.WARN, context: { email: EMAIL, url: `/x/${EMAIL}?q=${CANARY}` } });
  faro.api.pushError(new Error(`bad ${EMAIL} with ${JWT} at https://app.example.test/chats/c1/members/${EMAIL}?note=${CANARY}`));
  faro.api.pushEvent('chat_opened', { url: `/chats/c1/members/${EMAIL}?x=${CANARY}`, email: EMAIL, ip: IP });
  faro.api.pushMeasurement({ type: 'chat_render', values: { ms: 12 } }, { context: { page: `https://app.example.test/chats/c1?email=${EMAIL}` } });
  console.error(`console error for ${EMAIL} from ${IP} with ${JWT}`);
  console.warn(`console warning at /chats/c1?token=${JWT}`);
  console.log(`console log with message content ${CANARY}`); // content: must not be sent at all
  console.info(`console info with message content ${CANARY}`);
  console.debug(`console debug with message content ${CANARY}`);

  await vi.waitFor(
    () => {
      const sent = bodies.join('\n');
      for (const marker of ['chat_opened', 'chat_render', 'request failed', 'console error', 'console warning', 'bad ']) {
        expect(sent).toContain(marker);
      }
    },
    { timeout: 5000, interval: 50 },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Faro payloads sent to /collect', () => {
  it('carry no email, IP address, token or canary', () => {
    expect(describePii(findPii(bodies.join('\n'), { canaries }))).toBe('');
  });

  it('do not send console.log, info or debug output at all', () => {
    expect(bodies.join('\n')).not.toContain('console log with');
    expect(bodies.join('\n')).not.toContain('console info with');
    expect(bodies.join('\n')).not.toContain('console debug with');
  });

  it('carry no user identity', () => {
    const sent = bodies.join('\n');
    expect(sent).not.toContain('"username"');
    expect(sent).not.toContain('"user"');
  });
});
