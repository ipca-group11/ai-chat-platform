import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectFindings, countBySeverity, formatSummary, formatTable } from './sast-summary.ts';

const res = (ruleId: string, file: string, line: number, extra: Record<string, unknown> = {}) => ({
  ruleId,
  locations: [{ physicalLocation: { artifactLocation: { uri: file }, region: { startLine: line } } }],
  ...extra,
});
const sarif = {
  runs: [
    {
      tool: { driver: { rules: [{ id: 'r.err', defaultConfiguration: { level: 'error' } }, { id: 'r.warn', defaultConfiguration: { level: 'warning' } }] } },
      results: [
        res('r.err', 'a.ts', 3),
        res('r.warn', 'b.ts', 1),
        res('r.warn', 'c.ts', 2),
        res('r.err', 'd.ts', 9, { suppressions: [{ kind: 'inSource' }] }),
      ],
    },
  ],
};

test('collects findings, resolves severity from the rule and skips suppressed ones', () => {
  const f = collectFindings(sarif);
  assert.equal(f.length, 3);
  assert.deepEqual(countBySeverity(f), { error: 1, warning: 2, note: 0, none: 0 });
});

test('table groups by rule, lists ERROR first and shows file:line', () => {
  const out = formatTable(collectFindings(sarif));
  assert.match(out, /\| Rule \| Severity \| Count \| Locations \|/);
  assert.ok(out.indexOf('r.err') < out.indexOf('r.warn'));
  assert.match(out, /`r\.warn` \| WARNING \| 2 \| `b\.ts:1`, `c\.ts:2`/);
});

test('long location lists are cut', () => {
  const many = { runs: [{ results: [1, 2, 3, 4, 5].map((n) => res('x', `f${n}.ts`, n, { level: 'warning' })) }] };
  assert.match(formatTable(collectFindings(many)), /\+2 more/);
});

test('summary says blocked with ERROR and clean without', () => {
  assert.match(formatSummary(collectFindings(sarif)), /merge is blocked/);
  assert.match(formatSummary([]), /nothing blocks the merge/);
  assert.match(formatTable([]), /No findings/);
});
