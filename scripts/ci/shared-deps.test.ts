import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countCopies, duplicateChunks, formatResult, type Library } from './shared-deps.ts';

const libs: Library[] = [
  { name: 'react', marker: 'REACT_MARK' },
  { name: 'router', marker: 'ROUTER_MARK' },
];

test('a library whose marker is in one file is loaded once', () => {
  const result = countCopies(
    [
      { url: 'http://shell/assets/a.js', body: 'x REACT_MARK y' },
      { url: 'http://shell/assets/b.js', body: 'ROUTER_MARK' },
      { url: 'http://chat/assets/c.js', body: 'app code' },
    ],
    libs,
  );
  assert.deepEqual(result.map((r) => [r.name, r.once, r.files.length]), [['react', true, 1], ['router', true, 1]]);
});

test('a marker in a second file, for example a remote fallback, is a mismatch', () => {
  const result = countCopies(
    [
      { url: 'http://shell/assets/react-dom.js', body: 'REACT_MARK' },
      { url: 'http://chat/assets/prebuild-react-dom.js', body: 'REACT_MARK' },
    ],
    libs,
  );
  assert.equal(result[0]?.once, false);
  assert.deepEqual(result[0]?.files, ['http://shell/assets/react-dom.js', 'http://chat/assets/prebuild-react-dom.js']);
  assert.equal(result[1]?.once, false, 'a library that is not loaded at all is not "once" either');
  assert.equal(result[1]?.files.length, 0);
});

test('chunks with the same name but different hashes on several hosts are listed, biggest first', () => {
  const duplicates = duplicateChunks([
    { url: 'http://shell/assets/utils-AAAAAAAA.js', body: 'x'.repeat(100) },
    { url: 'http://chat/assets/utils-BBBBBBBB.js', body: 'x'.repeat(100) },
    { url: 'http://chat/assets/helpers-CCCCCCCC.js', body: 'y' },
    { url: 'http://auth/assets/helpers-DDDDDDDD.js', body: 'y' },
    { url: 'http://shell/assets/only-EEEEEEEE.js', body: 'z' },
    { url: 'http://shell/remoteEntry.js', body: 'e' },
    { url: 'http://chat/remoteEntry.js', body: 'e' },
  ]);
  assert.deepEqual(duplicates.map((d) => [d.chunk, d.urls.length, d.bytes]), [['/assets/utils.js', 2, 200], ['/assets/helpers.js', 2, 2]]);
});

test('the report says "loaded once" or MISMATCH for every library', () => {
  const text = formatResult(
    [{ name: 'react', files: ['http://shell/assets/a.js'], once: true }, { name: 'router', files: [], once: false }],
    [],
    7,
  );
  assert.match(text, /JS responses on \/chats: 7/);
  assert.match(text, /react \| 1 \| loaded once \| shell\/assets\/a\.js/);
  assert.match(text, /router \| 0 \| MISMATCH \| -/);
  assert.match(text, /none/);
});
