#!/usr/bin/env node
// Checks that the shared libraries (react, react-dom, router, query) are downloaded once when /chats opens
// (AICHAT-119). Module Federation is meant to share one copy of each library between the shell and the
// remotes; if a remote falls back to its own copy, the browser downloads the library twice.
//
// It opens the signed-in /chats page of the running stack in headless Chromium (the Playwright library of
// e2e/, no test is run), keeps every JavaScript response and looks for a marker string of each library in the
// bodies. One file with the marker means one copy. Exit code 1 when a library is found in more than one file.
//
//   CHECK_PASSWORD=... node scripts/ci/shared-deps.ts [--list]   (--list also prints every JS request)
//
// Variables: APP_URL (default http://localhost:8000, the stack of `pnpm mock:up`), CHECK_EMAIL, CHECK_PASSWORD (a throw-away account on the local stack; created if missing).
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface Library {
  name: string;
  /** A string that appears in the code of this library and nowhere else. */
  marker: string;
}

export const LIBRARIES: Library[] = [
  { name: 'react + react-dom', marker: 'react.memo_cache_sentinel' },
  { name: '@tanstack/react-query', marker: 'No QueryClient set' },
  { name: '@tanstack/react-router', marker: 'tsr-scroll-restoration' },
];

export interface LoadedFile {
  url: string;
  body: string;
}

export interface LibraryResult {
  name: string;
  files: string[];
  once: boolean;
}

/** The files whose body contains the marker of each library; `once` when there is exactly one. */
export function countCopies(files: LoadedFile[], libraries: Library[] = LIBRARIES): LibraryResult[] {
  return libraries.map(({ name, marker }) => {
    const found = files.filter((file) => file.body.includes(marker)).map((file) => file.url);
    return { name, files: found, once: found.length === 1 };
  });
}

const HASH = /-[A-Za-z0-9_-]{8}(?=\.js$)/;

/** Chunks with the same name (hash cut) loaded from more than one URL, for example a runtime helper per container. */
export function duplicateChunks(files: LoadedFile[]): { chunk: string; urls: string[]; bytes: number }[] {
  const byName = new Map<string, LoadedFile[]>();
  for (const file of files) {
    const path = new URL(file.url).pathname.replace(HASH, '');
    if (path === '/remoteEntry.js') continue; // one per container by design
    byName.set(path, [...(byName.get(path) ?? []), file]);
  }
  return [...byName.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([chunk, group]) => ({ chunk, urls: group.map((file) => file.url), bytes: group.reduce((sum, file) => sum + file.body.length, 0) }))
    .sort((a, b) => b.bytes - a.bytes);
}

export function formatResult(results: LibraryResult[], duplicates: ReturnType<typeof duplicateChunks>, requests: number): string {
  const short = (url: string): string => new URL(url).host + new URL(url).pathname.replace(/_virtual_mf___mfe_internal__/, '').replace(/__mf_owner__\d+__/, '__');
  const lines = [`JS responses on /chats: ${requests}`, '', 'Shared library | copies | verdict | files'];
  for (const result of results) {
    lines.push(`${result.name} | ${result.files.length} | ${result.once ? 'loaded once' : 'MISMATCH'} | ${result.files.map(short).join(', ') || '-'}`);
  }
  lines.push('', 'Chunks with the same name loaded from more than one URL (not shared libraries):');
  if (duplicates.length === 0) lines.push('none');
  for (const { chunk, urls, bytes } of duplicates) lines.push(`${chunk} x${urls.length} (${Math.round(bytes / 1000)} kB raw in total): ${urls.map((url) => new URL(url).host).join(', ')}`);
  return lines.join('\n');
}

interface Page {
  on(event: 'response', handler: (response: { url(): string; text(): Promise<string>; headers(): Record<string, string> }) => void): void;
  goto(url: string, options: { waitUntil: 'networkidle' }): Promise<unknown>;
  url(): string;
  waitForTimeout(ms: number): Promise<void>;
}
interface Playwright {
  chromium: {
    launch(): Promise<{
      newContext(): Promise<{ addCookies(cookies: { name: string; value: string; url: string }[]): Promise<void>; newPage(): Promise<Page> }>;
      close(): Promise<void>;
    }>;
  };
}

async function signIn(base: string, email: string, password: string): Promise<{ name: string; value: string; url: string }[]> {
  const post = (path: string): Promise<Response> =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const registered = await post('/auth/register');
  if (registered.status !== 201 && registered.status !== 409) throw new Error(`register failed: ${registered.status}`);
  const login = await post('/auth/login');
  if (login.status !== 200) throw new Error(`login failed: ${login.status}`);
  return login.headers.getSetCookie().map((line) => {
    const pair = line.split(';')[0] ?? '';
    const at = pair.indexOf('=');
    return { name: pair.slice(0, at), value: pair.slice(at + 1), url: base };
  });
}

export async function collectFiles(base: string, email: string, password: string): Promise<LoadedFile[]> {
  // The Playwright library is installed for e2e/ only; resolve it from there.
  const require = createRequire(resolve(fileURLToPath(import.meta.url), '../../../e2e/package.json'));
  const { chromium } = require('@playwright/test') as Playwright;
  const cookies = await signIn(base, email, password);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies(cookies);
    const page = await context.newPage();
    const pending: Promise<LoadedFile | null>[] = [];
    page.on('response', (response) => {
      if (/\.js(\?|$)/.test(response.url())) pending.push(response.text().then((body) => ({ url: response.url(), body }), () => null));
    });
    await page.goto(`${base}/chats`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if (!page.url().endsWith('/chats')) throw new Error(`not signed in: ended on ${page.url()}`);
    return (await Promise.all(pending)).filter((file): file is LoadedFile => file !== null);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = (process.env['APP_URL'] ?? 'http://localhost:8000').replace(/\/$/, '');
  const password = process.env['CHECK_PASSWORD'];
  if (!password) throw new Error('CHECK_PASSWORD is not set (an account of the throw-away local stack)');
  const files = await collectFiles(base, process.env['CHECK_EMAIL'] ?? 'shared-deps@check.example.com', password);
  const results = countCopies(files);
  if (process.argv.includes('--list')) {
    const shorten = (url: string): string => url.replace(/_virtual_mf___mfe_internal__/, '').replace(/__mf_owner__\d+__/, '__');
    process.stdout.write(`${files.map((file) => shorten(file.url).replace('http://', '')).sort().join('\n')}\n\n`);
  }
  process.stdout.write(`${formatResult(results, duplicateChunks(files), files.length)}\n`);
  process.exitCode = results.every((result) => result.once) ? 0 : 1;
}
