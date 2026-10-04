import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import {
  buildDeleteRequest,
  buildQuery,
  countMatches,
  DEFAULT_SELECTOR,
  listDeletes,
  RETENTION_MS,
  submitDelete,
  timeRange,
} from './loki-delete.ts';

const UUID = '3f2b1c9e-6d7a-4e0b-9c1d-2a8f5e4b7c60';
const LOKI = 'http://loki:3100';

afterEach(() => mock.restoreAll());

/** Replaces global fetch; records each call and answers with the given response. */
function fakeFetch(answer: () => Response): Array<{ url: URL; init?: RequestInit }> {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url: new URL(url), init });
    return answer();
  });
  return calls;
}

test('builds a selector plus a line filter on the id', () => {
  assert.equal(buildQuery(UUID), `${DEFAULT_SELECTOR} |= "${UUID}"`);
  assert.equal(buildQuery(UUID, '{kind="exception"}'), `{kind="exception"} |= "${UUID}"`);
});

test('rejects ids that could inject LogQL or match too much', () => {
  for (const bad of ['', 'short', 'abcdefgh"} |= "x', 'abc def ghij', 'abcdefgh\\n', 'x'.repeat(129)]) {
    assert.throws(() => buildQuery(bad), /id must be/);
  }
});

test('rejects a selector that is not a single stream selector', () => {
  assert.throws(() => buildQuery(UUID, 'app_name="shell"'), /selector/);
  assert.throws(() => buildQuery(UUID, '{a="b"} | json'), /selector/);
});

test('the default range is the 7-day retention window, in whole seconds', () => {
  const now = Date.parse('2026-10-04T12:00:00.750Z');
  const end = Math.floor(now / 1000);
  assert.deepEqual(timeRange(now), { start: end - RETENTION_MS / 1000, end });
});

test('the end is never in the future (Loki rejects it with 400)', () => {
  const now = Date.parse('2026-10-04T12:00:00.999Z');
  assert.equal(timeRange(now).end, Date.parse('2026-10-04T12:00:00Z') / 1000);
  assert.equal(timeRange(now, undefined, '2027-01-01T00:00:00Z').end, Date.parse('2026-10-04T12:00:00Z') / 1000);
});

test('explicit dates are used and checked', () => {
  const now = Date.parse('2026-10-04T12:00:00Z');
  const r = buildDeleteRequest(UUID, now, { start: '2026-10-01T00:00:00Z', end: '2026-10-02T00:00:00Z' });
  assert.deepEqual([r.start, r.end], [Date.parse('2026-10-01T00:00:00Z') / 1000, Date.parse('2026-10-02T00:00:00Z') / 1000]);
  assert.throws(() => timeRange(now, 'yesterday'), /not a date/);
  assert.throws(() => timeRange(now, '2026-10-02T00:00:00Z', '2026-10-01T00:00:00Z'), /before/);
  assert.throws(() => timeRange(now, '2026-10-05T00:00:00Z'), /before/);
});

test('submitDelete POSTs query, start and end in seconds with the tenant header', async () => {
  const calls = fakeFetch(() => new Response(null, { status: 204 }));
  await submitDelete(LOKI, 'fake', { query: buildQuery(UUID), start: 100, end: 200 });
  assert.equal(calls.length, 1);
  const [{ url, init }] = calls as [{ url: URL; init?: RequestInit }];
  assert.equal(url.pathname, '/loki/api/v1/delete');
  assert.equal(init?.method, 'POST');
  assert.deepEqual((init?.headers as Record<string, string>)['X-Scope-OrgID'], 'fake');
  assert.equal(url.searchParams.get('query'), `${DEFAULT_SELECTOR} |= "${UUID}"`);
  assert.equal(url.searchParams.get('start'), '100');
  assert.equal(url.searchParams.get('end'), '200');
});

test('submitDelete reports the error Loki returns', async () => {
  fakeFetch(() => new Response('deletes in the future are not allowed', { status: 400 }));
  await assert.rejects(submitDelete(LOKI, 'fake', { query: buildQuery(UUID), start: 1, end: 2 }), /HTTP 400 deletes in the future/);
});

test('countMatches adds the lines of every stream, with the range in nanoseconds', async () => {
  const calls = fakeFetch(() =>
    Response.json({ data: { result: [{ values: [['1', 'a'], ['2', 'b']] }, { values: [['3', 'c']] }] } }),
  );
  assert.equal(await countMatches(LOKI, 'fake', { query: buildQuery(UUID), start: 10, end: 20 }), 3);
  const url = calls[0]?.url as URL;
  assert.equal(url.pathname, '/loki/api/v1/query_range');
  assert.equal(url.searchParams.get('start'), String(10 * 1e9));
  assert.equal(url.searchParams.get('end'), String(20 * 1e9));
});

test('listDeletes returns the requests Loki knows about', async () => {
  const requests = [{ request_id: 'f5ee9394', status: 'received' }];
  fakeFetch(() => Response.json(requests));
  assert.deepEqual(await listDeletes(LOKI, 'fake'), requests);
});
