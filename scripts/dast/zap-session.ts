#!/usr/bin/env node
// Signs in the seeded DAST user (creating it and a few chats on the first run) and prints the ZAP options that
// add the session cookie to every request of the scan. Pass the output to zap-baseline.py with -z:
//   ZAP_OPTS="$(node scripts/dast/zap-session.ts)"; zap-baseline.py ... -z "$ZAP_OPTS"
// The cookie is a live session of a throw-away account on a local stack. It is only written to stdout, never to a file.
// Variables: DAST_BASE_URL (default http://localhost:8000, the shell, which proxies /auth and /api),
// DAST_EMAIL, DAST_PASSWORD, DAST_CHATS (number of chats to seed, default 3).
import { pathToFileURL } from 'node:url';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** `name=value` pairs of the Set-Cookie headers of a response, joined into one Cookie header value. */
export function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies
    .map((line) => line.split(';')[0]?.trim() ?? '')
    .filter((pair) => pair.includes('=') && !pair.endsWith('='))
    .join('; ');
}

/** ZAP `-z` options: a replacer rule that sets the Cookie header on every request. */
export function buildReplacerOptions(cookie: string): string {
  const rule = 'replacer.full_list(0)';
  return [
    `-config ${rule}.description=dast-session`,
    `-config ${rule}.enabled=true`,
    `-config ${rule}.matchtype=REQ_HEADER`,
    `-config ${rule}.matchstr=Cookie`,
    `-config ${rule}.regex=false`,
    `-config ${rule}.replacement=${cookie}`,
  ].join(' ');
}

async function post(base: string, path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: cookie ? { ...JSON_HEADERS, Cookie: cookie } : JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/** Registers (409 means it exists), signs in and seeds `chats` chats; returns the Cookie header value. */
export async function signInSeededUser(base: string, email: string, password: string, chats: number): Promise<string> {
  const registered = await post(base, '/auth/register', { email, password });
  if (registered.status !== 201 && registered.status !== 409) throw new Error(`register failed: ${registered.status}`);
  const login = await post(base, '/auth/login', { email, password });
  if (login.status !== 200) throw new Error(`login failed: ${login.status}`);
  const cookie = cookieHeaderFrom(login.headers.getSetCookie());
  if (!cookie) throw new Error('login returned no session cookie');
  const existing = await fetch(`${base}/api/chats`, { headers: { Cookie: cookie } });
  const have = existing.ok ? ((await existing.json()) as { chats?: unknown[] }).chats?.length ?? 0 : 0;
  for (let n = have; n < chats; n += 1) {
    const created = await post(base, '/api/chats', { title: `DAST chat ${n + 1}`, provider: 'anthropic', model: 'claude-sonnet-4-5' }, cookie);
    if (created.status !== 201) throw new Error(`create chat failed: ${created.status}`);
  }
  return cookie;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = (process.env['DAST_BASE_URL'] ?? 'http://localhost:8000').replace(/\/$/, '');
  const email = process.env['DAST_EMAIL'] ?? 'dast-user@dast.example.com';
  const password = process.env['DAST_PASSWORD'] ?? 'DastScan-1234';
  const cookie = await signInSeededUser(base, email, password, Number(process.env['DAST_CHATS'] ?? 3));
  process.stdout.write(buildReplacerOptions(cookie));
}
