import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessCookie, budgetFor, buildRunConfig, median, pageLabel, renderMarkdown, summarise } from './config.ts';
import type { LhciConfig, MatrixEntry } from './config.ts';

const matrix: MatrixEntry[] = [
  {
    matchingUrlPattern: '^http://[^/]+/(login|register)$',
    assertions: {
      'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
      'total-blocking-time': ['error', { maxNumericValue: 200 }],
      'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
    },
  },
  {
    matchingUrlPattern: '^http://[^/]+/(chats|chats/[^/]+|settings)$',
    assertions: {
      'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
      'total-blocking-time': ['error', { maxNumericValue: 300 }],
      'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
    },
  },
];

const template: LhciConfig = {
  ci: {
    collect: { url: ['http://localhost:8000/login', 'http://localhost:8000/chats/{CHAT_ID}'], numberOfRuns: 3, settings: { preset: 'desktop' } },
    assert: { assertMatrix: matrix },
    upload: { target: 'filesystem', outputDir: 'out' },
  },
};

test('keeps only the access token cookie', () => {
  assert.equal(accessCookie(['refresh_token=r; Path=/auth', 'access_token=abc; HttpOnly']), 'access_token=abc');
  assert.equal(accessCookie(['access_token=; Max-Age=0']), '');
  assert.equal(accessCookie([]), '');
});

test('fills the chat id, the origin and the cookie header without touching the template', () => {
  const run = buildRunConfig(template, 'http://localhost:9000/', 'c1', 'access_token=abc');
  assert.deepEqual(run.ci.collect.url, ['http://localhost:9000/login', 'http://localhost:9000/chats/c1']);
  assert.deepEqual(run.ci.collect.settings, { preset: 'desktop', extraHeaders: { Cookie: 'access_token=abc' } });
  assert.equal(run.ci.collect.numberOfRuns, 3);
  assert.equal(template.ci.collect.url[1], 'http://localhost:8000/chats/{CHAT_ID}');
  assert.equal('extraHeaders' in template.ci.collect.settings, false);
});

test('median of odd and even lists', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.ok(Number.isNaN(median([])));
});

test('labels the chat page without its id', () => {
  assert.equal(pageLabel('http://localhost:8000/chats/1b9d-22'), '/chats/:id');
  assert.equal(pageLabel('http://localhost:8000/chats'), '/chats');
});

test('finds the budget by URL pattern, stricter for the auth pages', () => {
  assert.equal(budgetFor('http://localhost:8000/login', matrix)?.lcp, 2000);
  assert.equal(budgetFor('http://localhost:8000/chats/abc', matrix)?.tbt, 300);
  assert.equal(budgetFor('http://localhost:8000/other', matrix), null);
});

test('summarises the median per page and judges it against the budget', () => {
  const run = (finalUrl: string, lcp: number, tbt = 10, cls = 0) => ({ finalUrl, lcp, tbt, cls });
  const rows = summarise(
    [run('http://localhost:8000/login', 1500), run('http://localhost:8000/login', 2600), run('http://localhost:8000/login', 1600), run('http://localhost:8000/chats', 2400)],
    matrix,
  );
  assert.equal(rows[0]?.lcp, 1600); // one slow run does not fail the page: median
  assert.equal(rows[0]?.pass, true);
  const tight = summarise([run('http://localhost:8000/login', 2100)], matrix);
  assert.equal(tight[0]?.pass, false);
  assert.match(renderMarkdown(rows), /\| `\/login` \| 3 \| 1600 ms \(2000 ms\)/);
});
