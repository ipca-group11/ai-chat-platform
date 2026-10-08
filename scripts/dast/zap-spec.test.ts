import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildZapSpec, readServiceSpecs, render } from './zap-spec.ts';

const root = new URL('../../', import.meta.url);
const { auth, conversation } = readServiceSpecs(root);
const spec = buildZapSpec(auth, conversation);

describe('ZAP API scan spec (AICHAT-187)', () => {
  it('the committed testing/zap/openapi.json is up to date (run `node scripts/dast/zap-spec.ts` after a spec change)', () => {
    assert.equal(readFileSync(new URL('testing/zap/openapi.json', root), 'utf-8'), render(spec));
  });

  it('puts auth-service under /auth and conversation-service under /api, through the shell', () => {
    assert.deepEqual(spec.servers, [{ url: 'http://localhost:8000' }]);
    for (const path of Object.keys(spec.paths)) assert.match(path, /^\/(auth|api)\//);
    assert.ok(spec.paths['/auth/login']);
    assert.ok(spec.paths['/api/chats/{chatId}/messages']);
  });

  it('leaves out account deletion, the internal routes, the stream, /health and /metrics', () => {
    assert.equal(spec.paths['/auth/me']?.['delete'], undefined);
    assert.ok(spec.paths['/auth/me']?.['get']);
    assert.equal(spec.paths['/api/chats/{chatId}/stream'], undefined);
    for (const path of Object.keys(spec.paths)) assert.doesNotMatch(path, /\/internal\/|\/health$|\/metrics$/);
  });
});
