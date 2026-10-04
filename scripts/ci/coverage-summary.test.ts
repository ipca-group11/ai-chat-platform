import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatTable } from './coverage-summary.ts';

const m = (pct: number) => ({ pct });

test('formats one row per project with two decimals', () => {
  const out = formatTable([
    { project: 'packages/ui', total: { lines: m(91.234), branches: m(80), functions: m(100), statements: m(90) } },
  ]);
  assert.match(out, /\| Project \| Lines \| Branches \| Functions \| Statements \|/);
  assert.match(out, /\| packages\/ui \| 91\.23% \| 80\.00% \| 100\.00% \| 90\.00% \|/);
});

test('shows n/a for missing metrics and a placeholder when empty', () => {
  assert.match(formatTable([{ project: 'x', total: {} }]), /\| x \| n\/a \| n\/a \| n\/a \| n\/a \|/);
  assert.match(formatTable([]), /no coverage-summary\.json found/);
});
