import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compare, formatReport, normaliseName, snapshot } from './bundle-size.ts';

test('cuts the content hash from a chunk name', () => {
  assert.equal(normaliseName('assets/index-BCMqHVD7.js'), 'assets/index.js');
  assert.equal(normaliseName('assets/mf-entry-bootstrap-0-a5cf77d9.js'), 'assets/mf-entry-bootstrap-0.js');
  assert.equal(normaliseName('assets/x__loadShare__.js--4a9cwDo.js'), 'assets/x__loadShare__.js.js');
  assert.equal(normaliseName('remoteEntry.js'), 'remoteEntry.js');
  assert.equal(normaliseName('assets/index-BTgjxohI.css'), 'assets/index.css');
});

test('snapshot reads the gzip size of every js and css file of each built app', () => {
  const root = mkdtempSync(join(tmpdir(), 'bundle-size-'));
  mkdirSync(join(root, 'apps/shell/dist/assets'), { recursive: true });
  mkdirSync(join(root, 'apps/unbuilt'), { recursive: true });
  writeFileSync(join(root, 'apps/shell/dist/remoteEntry.js'), 'a'.repeat(5000));
  writeFileSync(join(root, 'apps/shell/dist/assets/index-BCMqHVD7.js'), 'b'.repeat(5000));
  writeFileSync(join(root, 'apps/shell/dist/index.html'), '<html></html>');
  const result = snapshot(root);
  assert.deepEqual(Object.keys(result), ['shell']);
  const files = result.shell ?? {};
  assert.deepEqual(Object.keys(files).sort(), ['assets/index.js', 'remoteEntry.js']);
  assert.ok((files['remoteEntry.js'] ?? Infinity) < 100, 'repeated text compresses well');
});

test('compare lists new, removed and changed files and skips unchanged ones', () => {
  const base = { shell: { 'a.js': 100, 'b.js': 200, 'c.js': 300 } };
  const head = { shell: { 'a.js': 100, 'b.js': 250, 'd.js': 40 } };
  assert.deepEqual(compare(base, head), [
    { app: 'shell', file: 'b.js', before: 200, after: 250 },
    { app: 'shell', file: 'c.js', before: 300, after: null },
    { app: 'shell', file: 'd.js', before: null, after: 40 },
  ]);
});

test('compare ignores apps that have no build on the base', () => {
  assert.deepEqual(compare({}, { shell: { 'a.js': 1 } }), []);
});

test('report has before, after and change per file and a total per app', () => {
  const report = formatReport({ 'mfe-chat': { 'a.js': 60000, 'b.js': 1000 } }, { 'mfe-chat': { 'a.js': 63000, 'b.js': 1000 } });
  assert.match(report, /\| mfe-chat \(all JS and CSS\) \| 61\.00 kB \| 64\.00 kB \| \+3\.00 kB \(\+4\.9%\) \|/);
  assert.match(report, /\| mfe-chat \| `a\.js` \| 60\.00 kB \| 63\.00 kB \| \+3\.00 kB \(\+5\.0%\) \|/);
  assert.doesNotMatch(report, /`b\.js`/);
});

test('report marks new and removed files and says so when nothing changed', () => {
  const changed = formatReport({ shell: { 'old.js': 2000 } }, { shell: { 'new.js': 3000 } });
  assert.match(changed, /`old\.js` \(removed\) \| 2\.00 kB \| - \| -2\.00 kB \(-100\.0%\)/);
  assert.match(changed, /`new\.js` \(new\) \| - \| 3\.00 kB \| \+3\.00 kB \|/);
  assert.match(formatReport({ shell: { 'a.js': 1 } }, { shell: { 'a.js': 1 } }), /No file changed in size\./);
});

test('report names the apps that were not built on the base and handles an empty comparison', () => {
  assert.match(formatReport({ shell: { 'a.js': 1 } }, { shell: { 'a.js': 1 }, 'mfe-auth': { 'a.js': 1 } }), /Not compared \(no build on the base\): mfe-auth\./);
  assert.match(formatReport({}, { shell: { 'a.js': 1 } }), /nothing to compare/);
});

test('small changes are shown in bytes', () => {
  assert.match(formatReport({ shell: { 'a.js': 1000 } }, { shell: { 'a.js': 1008 } }), /\| \+8 B \(\+0\.8%\) \|/);
});
