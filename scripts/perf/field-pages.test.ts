import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromeCandidates, plan, visitsFor } from './field-pages.ts';

test('a round visits the five audited pages, the sign-in pages without a session', () => {
  const visits = visitsFor('abc');
  assert.deepEqual(
    visits.map((v) => v.path),
    ['/login', '/register', '/chats', '/chats/abc', '/settings'],
  );
  assert.deepEqual(
    visits.filter((v) => !v.signedIn).map((v) => v.path),
    ['/login', '/register'],
  );
});

test('the plan repeats the round and handles zero rounds', () => {
  assert.equal(plan('abc', 4).length, 20);
  assert.equal(plan('abc', 0).length, 0);
});

test('CHROME_PATH is tried first', () => {
  assert.equal(chromeCandidates({ CHROME_PATH: '/x/chrome' })[0], '/x/chrome');
  assert.ok(chromeCandidates({}).some((p) => p.includes('Google Chrome')));
});
