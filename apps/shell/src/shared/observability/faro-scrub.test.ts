import type { TransportItem } from '@grafana/faro-web-sdk';
import { describe, expect, it } from 'vitest';
import { REDACTED, scrubString, scrubTransportItem, scrubUrl, scrubValue } from './faro-scrub';

const EMAIL = 'ana@pii-canary.example.com';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl';

describe('scrubUrl', () => {
  it('drops the query string and the fragment', () => {
    expect(scrubUrl(`https://app.example.test/chats/c1?email=${EMAIL}#top`)).toBe('https://app.example.test/chats/c1');
  });

  it('masks an email in the path, plain or percent-encoded', () => {
    expect(scrubUrl(`/chats/c1/members/${EMAIL}`)).toBe(`/chats/c1/members/${REDACTED}`);
    expect(scrubUrl('/chats/c1/members/ana%40pii-canary.example.com')).toBe(`/chats/c1/members/${REDACTED}`);
  });

  it('keeps a clean path, also when it is not valid percent-encoding', () => {
    expect(scrubUrl('/chats/c1')).toBe('/chats/c1');
    expect(scrubUrl('/x/100%')).toBe('/x/100%');
    expect(scrubUrl('')).toBe('');
  });
});

describe('scrubString', () => {
  it('masks emails, IPv4, IPv6, tokens and keys in free text', () => {
    expect(scrubString(`from ${EMAIL} at 203.0.113.7 and 2001:db8::1 with ${JWT} Bearer abcdef123456 sk-ant-api03-AbCdEf123456`)).toBe(
      `from ${REDACTED} at ${REDACTED} and ${REDACTED} with ${REDACTED} ${REDACTED} ${REDACTED}`,
    );
  });

  it('cuts the query string of a URL inside text', () => {
    expect(scrubString('Failed to fetch https://app.example.test/api/chats?x=1 (404)')).toBe('Failed to fetch https://app.example.test/api/chats (404)');
  });

  it('treats a whole string that is a path or a URL as a URL', () => {
    expect(scrubString('/chats/c1?x=1')).toBe('/chats/c1');
  });

  it('leaves other text alone', () => {
    expect(scrubString('pino 10.3.1 at 12:30:45 failed')).toBe('pino 10.3.1 at 12:30:45 failed');
  });
});

describe('scrubValue', () => {
  it('replaces sensitive keys whatever their value and scrubs nested strings', () => {
    expect(
      scrubValue({ email: EMAIL, user_name: 'ana', 'api-key': 'k', content: 'hello', nested: [{ url: `/a/${EMAIL}?q=1` }, 3, null, true], n: 1 }),
    ).toEqual({ email: REDACTED, user_name: REDACTED, 'api-key': REDACTED, content: REDACTED, nested: [{ url: `/a/${REDACTED}` }, 3, null, true], n: 1 });
  });
});

describe('scrubTransportItem', () => {
  const item = {
    type: 'log',
    payload: { message: `failed for ${EMAIL}`, context: { url: `/x?e=${EMAIL}` }, level: 'warn' },
    meta: { page: { url: `https://app.example.test/chats/c1?email=${EMAIL}` }, user: { id: 'u1', email: EMAIL, username: 'ana' }, app: { name: 'llm-chat' } },
  } as unknown as TransportItem;

  it('scrubs payload and meta and drops the user meta', () => {
    const out = scrubTransportItem(item);
    expect(out.type).toBe('log');
    expect(out.payload).toEqual({ message: `failed for ${REDACTED}`, context: { url: '/x' }, level: 'warn' });
    expect(out.meta).toEqual({ page: { url: 'https://app.example.test/chats/c1' }, app: { name: 'llm-chat' } });
  });

  it('does not change the item it is given', () => {
    scrubTransportItem(item);
    expect(JSON.stringify(item)).toContain(EMAIL);
  });
});
