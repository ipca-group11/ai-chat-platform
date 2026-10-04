#!/usr/bin/env node
// Telemetry erasure on request (AICHAT-249, GDPR Art. 17). Loki lines carry no user id, so a request is matched by an
// identifier the user can give us: a correlation id (`X-Correlation-Id`), a Faro session id, or any other token that
// appears in the line. The script asks Loki's compactor to delete every line that contains it in a time range.
//
//   node scripts/gdpr/loki-delete.ts --id <value> [--start <ISO>] [--end <ISO>] [--selector '{app_name=~".+"}']
//                                    [--loki http://localhost:3100] [--tenant fake] [--dry-run] [--yes]
//   node scripts/gdpr/loki-delete.ts --list [--loki ...]
//
// Without --yes it only counts the matching lines (same as --dry-run). Deletion needs `compactor.retention_enabled`
// and `compactor.delete_request_store` in observability/loki.yml; Loki hides the lines from queries at once and
// removes them from the chunks when the cancel period (`delete_request_cancel_period`) has passed.
// Dependency-free on purpose: it runs on a plain `node:24` container attached to the compose network.
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export const DEFAULT_SELECTOR = '{app_name=~".+"}';
/** Loki keeps telemetry 7 days (docs/AICHAT-33/RETENTION.md), so nothing older can match. */
export const RETENTION_MS = 7 * 24 * 3600 * 1000;

const ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const SELECTOR_PATTERN = /^\{[^{}`]+\}$/;

export interface DeleteRequest {
  query: string;
  start: number;
  end: number;
}

/**
 * The LogQL query of a delete request: a stream selector and a line filter on the identifier. The identifier is
 * restricted to the characters of a UUID or token, so it cannot close the string or add LogQL of its own.
 */
export function buildQuery(id: string, selector: string = DEFAULT_SELECTOR): string {
  if (!ID_PATTERN.test(id)) {
    throw new Error('id must be 8 to 128 characters of [A-Za-z0-9._:-] (a correlation or session id)');
  }
  if (!SELECTOR_PATTERN.test(selector)) {
    throw new Error('selector must be a single LogQL stream selector such as {app_name=~".+"}');
  }
  return `${selector} |= "${id}"`;
}

/**
 * Start and end in whole Unix seconds, as the delete API expects; defaults to the whole retention window. The end is
 * never after `now`: Loki answers 400 "deletes in the future are not allowed", even for a fraction of a second.
 */
export function timeRange(now: number, start?: string, end?: string): { start: number; end: number } {
  const parse = (value: string, name: string): number => {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) throw new Error(`--${name} "${value}" is not a date (use ISO 8601, e.g. 2026-10-04T12:00:00Z)`);
    return ms;
  };
  const endSec = Math.floor(Math.min(end ? parse(end, 'end') : now, now) / 1000);
  const startSec = Math.floor((start ? parse(start, 'start') : endSec * 1000 - RETENTION_MS) / 1000);
  if (startSec >= endSec) throw new Error('--start must be before --end (and before now)');
  return { start: startSec, end: endSec };
}

export function buildDeleteRequest(id: string, now: number, opts: { selector?: string; start?: string; end?: string } = {}): DeleteRequest {
  return { query: buildQuery(id, opts.selector), ...timeRange(now, opts.start, opts.end) };
}

function headers(tenant: string): Record<string, string> {
  return { 'X-Scope-OrgID': tenant };
}

/** Number of log lines the request matches now (query_range, up to 5000). */
export async function countMatches(loki: string, tenant: string, req: DeleteRequest): Promise<number> {
  const params = new URLSearchParams({
    query: req.query,
    start: String(req.start * 1e9),
    end: String(req.end * 1e9),
    limit: '5000',
    direction: 'forward',
  });
  const res = await fetch(`${loki}/loki/api/v1/query_range?${params}`, { headers: headers(tenant) });
  if (!res.ok) throw new Error(`query_range: HTTP ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data?: { result?: Array<{ values?: unknown[] }> } };
  return (body.data?.result ?? []).reduce((n, stream) => n + (stream.values?.length ?? 0), 0);
}

export async function submitDelete(loki: string, tenant: string, req: DeleteRequest): Promise<void> {
  const params = new URLSearchParams({ query: req.query, start: String(req.start), end: String(req.end) });
  const res = await fetch(`${loki}/loki/api/v1/delete?${params}`, { method: 'POST', headers: headers(tenant) });
  if (res.status !== 204 && !res.ok) throw new Error(`delete: HTTP ${res.status} ${await res.text()}`);
}

export async function listDeletes(loki: string, tenant: string): Promise<unknown> {
  const res = await fetch(`${loki}/loki/api/v1/delete`, { headers: headers(tenant) });
  if (!res.ok) throw new Error(`list: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      id: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      selector: { type: 'string', default: DEFAULT_SELECTOR },
      loki: { type: 'string', default: process.env.LOKI_URL ?? 'http://localhost:3100' },
      tenant: { type: 'string', default: 'fake' },
      'dry-run': { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      list: { type: 'boolean', default: false },
    },
  });
  const loki = values.loki.replace(/\/+$/, '');

  if (values.list) {
    console.log(JSON.stringify(await listDeletes(loki, values.tenant), null, 2));
    return 0;
  }
  if (!values.id) {
    console.error('usage: loki-delete.ts --id <correlation-or-session-id> [--start ISO] [--end ISO] [--yes] | --list');
    return 2;
  }

  const req = buildDeleteRequest(values.id, Date.now(), values);
  const range = `${new Date(req.start * 1000).toISOString()} .. ${new Date(req.end * 1000).toISOString()}`;
  console.log(`query: ${req.query}`);
  console.log(`range: ${range}`);
  console.log(`matching lines now: ${await countMatches(loki, values.tenant, req)}`);

  if (values['dry-run'] || !values.yes) {
    console.log('dry run: nothing deleted (add --yes to submit the delete request)');
    return 0;
  }
  await submitDelete(loki, values.tenant, req);
  console.log('delete request accepted; Loki filters the lines from queries now and purges them after the cancel period');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    },
  );
}
