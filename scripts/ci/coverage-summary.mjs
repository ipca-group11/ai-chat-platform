#!/usr/bin/env node
// Collects every `coverage/coverage-summary.json` (Vitest json-summary reporter)
// and writes a Markdown table to $GITHUB_STEP_SUMMARY, or to stdout when unset.
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP = new Set(['node_modules', '.git', '.nx', 'dist']);

export function findSummaries(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.name === 'coverage') {
        try {
          readFileSync(join(full, 'coverage-summary.json'));
          found.push(join(full, 'coverage-summary.json'));
        } catch {
          // no summary in this coverage folder
        }
      } else {
        walk(full);
      }
    }
  };
  walk(root);
  return found.sort();
}

const pct = (metric) =>
  metric && typeof metric.pct === 'number' ? `${metric.pct.toFixed(2)}%` : 'n/a';

export function formatTable(rows) {
  const lines = [
    '## Coverage per project',
    '',
    '| Project | Lines | Branches | Functions | Statements |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  for (const { project, total } of rows) {
    lines.push(
      `| ${project} | ${pct(total.lines)} | ${pct(total.branches)} | ${pct(total.functions)} | ${pct(total.statements)} |`,
    );
  }
  if (rows.length === 0) lines.push('| _no coverage-summary.json found_ | | | | |');
  return `${lines.join('\n')}\n`;
}

export function buildReport(root) {
  const rows = findSummaries(root).map((file) => ({
    project: relative(root, dirname(dirname(file))) || '.',
    total: JSON.parse(readFileSync(file, 'utf8')).total ?? {},
  }));
  return formatTable(rows);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = buildReport(resolve(process.argv[2] ?? process.cwd()));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  else process.stdout.write(report);
}
