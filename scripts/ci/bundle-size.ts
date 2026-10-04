#!/usr/bin/env node
// Bundle size per file, and the change between two builds (AICHAT-101).
//
//   node scripts/ci/bundle-size.ts snapshot [--root <dir>] --out sizes.json
//       gzip size of every .js and .css file in apps/*/dist of <dir> (default: the current directory)
//   node scripts/ci/bundle-size.ts report <base.json> <head.json>
//       Markdown table with before/after per changed file, appended to $GITHUB_STEP_SUMMARY
//       (printed when the variable is not set)
//
// File names carry a content hash (`index-BCMqHVD7.js`); the hash is cut so the same chunk is found
// in both builds (`index.js`).
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** app -> normalised file name -> gzip bytes (several files can fold into one name: they are summed). */
export type Snapshot = Record<string, Record<string, number>>;

export interface Row {
  app: string;
  file: string;
  before: number | null;
  after: number | null;
}

const HASH = /-[A-Za-z0-9_-]{8}(?=\.(js|css)$)/;

/** `assets/index-BCMqHVD7.js` -> `assets/index.js`. */
export function normaliseName(path: string): string {
  return path.replace(HASH, '');
}

function listAssets(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|css)$/.test(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

export function snapshot(root: string): Snapshot {
  const result: Snapshot = {};
  const appsDir = join(root, 'apps');
  if (!existsSync(appsDir)) return result;
  for (const app of readdirSync(appsDir).sort()) {
    const dist = join(appsDir, app, 'dist');
    if (!existsSync(dist)) continue;
    const files: Record<string, number> = {};
    for (const file of listAssets(dist)) {
      const name = normaliseName(relative(dist, file).split('\\').join('/'));
      files[name] = (files[name] ?? 0) + gzipSync(readFileSync(file), { level: 9 }).length;
    }
    result[app] = files;
  }
  return result;
}

/** One row per file that is new, gone or different, for the apps that were built in both snapshots. */
export function compare(base: Snapshot, head: Snapshot): Row[] {
  const rows: Row[] = [];
  for (const app of Object.keys(head).sort()) {
    const before = base[app];
    if (!before) continue;
    const after = head[app] ?? {};
    for (const file of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      const row: Row = { app, file, before: before[file] ?? null, after: after[file] ?? null };
      if (row.before !== row.after) rows.push(row);
    }
  }
  return rows;
}

const kb = (bytes: number): string => `${(bytes / 1000).toFixed(2)} kB`;

function delta(before: number | null, after: number | null): string {
  const change = (after ?? 0) - (before ?? 0);
  const sign = change > 0 ? '+' : change < 0 ? '-' : '';
  const percent = before ? ` (${sign}${((Math.abs(change) / before) * 100).toFixed(1)}%)` : '';
  const size = Math.abs(change) < 1000 ? `${Math.abs(change)} B` : kb(Math.abs(change));
  return `${sign}${size}${percent}`;
}

function total(files: Record<string, number> | undefined): number {
  return Object.values(files ?? {}).reduce((sum, bytes) => sum + bytes, 0);
}

export function formatReport(base: Snapshot, head: Snapshot): string {
  const apps = Object.keys(head).filter((app) => base[app]);
  const skipped = Object.keys(head).filter((app) => !base[app]);
  const rows = compare(base, head);
  const lines = ['## Bundle size change (gzip)', ''];
  if (apps.length === 0) {
    lines.push('_No app was built on both sides, nothing to compare._', '');
    return lines.join('\n');
  }
  lines.push('| App | Before | After | Change |', '| --- | ---: | ---: | ---: |');
  for (const app of apps.sort()) {
    lines.push(`| ${app} (all JS and CSS) | ${kb(total(base[app]))} | ${kb(total(head[app]))} | ${delta(total(base[app]), total(head[app]))} |`);
  }
  lines.push('');
  if (rows.length === 0) {
    lines.push('No file changed in size.', '');
  } else {
    lines.push('| App | File | Before | After | Change |', '| --- | --- | ---: | ---: | ---: |');
    for (const { app, file, before, after } of rows) {
      const state = before === null ? ' (new)' : after === null ? ' (removed)' : '';
      lines.push(
        `| ${app} | \`${file}\`${state} | ${before === null ? '-' : kb(before)} | ${after === null ? '-' : kb(after)} | ${delta(before, after)} |`,
      );
    }
    lines.push('');
  }
  if (skipped.length > 0) lines.push(`Not compared (no build on the base): ${skipped.join(', ')}.`, '');
  return lines.join('\n');
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function main(args: string[]): number {
  const [command, ...rest] = args;
  if (command === 'snapshot') {
    const out = option(rest, '--out');
    if (!out) {
      process.stderr.write('usage: bundle-size.ts snapshot [--root <dir>] --out <file>\n');
      return 2;
    }
    writeFileSync(out, `${JSON.stringify(snapshot(resolve(option(rest, '--root') ?? process.cwd())), null, 2)}\n`);
    return 0;
  }
  if (command === 'report' && rest.length === 2) {
    const read = (file: string): Snapshot => JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
    const report = formatReport(read(rest[0] as string), read(rest[1] as string));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
    else process.stdout.write(`${report}\n`);
    return 0;
  }
  process.stderr.write('usage: bundle-size.ts snapshot --out <file> | report <base.json> <head.json>\n');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
