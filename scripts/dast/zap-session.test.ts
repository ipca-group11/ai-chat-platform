import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReplacerOptions, cookieHeaderFrom, pickCookies } from './zap-session.ts';

test('joins the name=value pairs of Set-Cookie headers and drops attributes and empty cookies', () => {
  const header = cookieHeaderFrom(['access_token=abc; Path=/; HttpOnly; SameSite=Lax', 'refresh_token=def; Path=/auth; HttpOnly', 'old=; Max-Age=0']);
  assert.equal(header, 'access_token=abc; refresh_token=def');
});

test('builds a ZAP replacer rule that sets the Cookie request header', () => {
  const options = buildReplacerOptions('access_token=abc');
  assert.match(options, /replacer\.full_list\(0\)\.matchtype=REQ_HEADER/);
  assert.match(options, /replacer\.full_list\(0\)\.matchstr=Cookie/);
  assert.match(options, /replacer\.full_list\(0\)\.replacement=access_token=abc$/);
  assert.match(options, /replacer\.full_list\(0\)\.enabled=true/);
});

test('keeps only the named cookies, joined without spaces', () => {
  assert.equal(pickCookies('access_token=abc; refresh_token=def', ['access_token']), 'access_token=abc');
  assert.equal(pickCookies('a=1; b=2; c=3', ['a', 'c']), 'a=1;c=3');
});

test('refuses a cookie with whitespace, which ZAP would split into separate options', () => {
  assert.throws(() => buildReplacerOptions('access_token=abc; refresh_token=def'), /whitespace/);
});
