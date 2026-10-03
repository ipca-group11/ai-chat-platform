#!/usr/bin/env node
// Reads a Semgrep SARIF file, prints a Markdown table (rule, severity, count, locations) and sets the exit code.
//   node scripts/ci/sast-summary.ts semgrep-results/semgrep.sarif   -> exit 1 if an unsuppressed ERROR exists
// Findings silenced with `nosemgrep` carry a "suppressions" entry in the SARIF and are not counted.
// Dependency-free on purpose: it runs on a plain runner before any `pnpm install`.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

type Level = 'error' | 'warning' | 'note' | 'none';

const ORDER: Record<Level, number> = { error: 0, warning: 1, note: 2, none: 3 };
const LABEL: Record<Level, string> = { error: 'ERROR', warning: 'WARNING', note: 'INFO', none: 'INFO' };

interface SarifResult {
  ruleId?: string;
  level?: string;
  suppressions?: unknown[];
  locations?: Array<{
    physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number } };
  }>;
}

interface SarifRule {
  id: string;
  defaultConfiguration?: { level?: string };
}

export interface Sarif {
  runs?: Array<{ tool?: { driver?: { rules?: SarifRule[] } }; results?: SarifResult[] }>;
}

export interface Finding {
  rule: string;
  level: Level;
  file: string;
  line: number;
}

const isLevel = (level: string): level is Level => level in ORDER;

/** Flattens the SARIF into [{ rule, level, file, line }], skipping suppressed results. */
export function collectFindings(sarif: Sarif): Finding[] {
  const out: Finding[] = [];
  for (const run of sarif.runs ?? []) {
    const rules = new Map((run.tool?.driver?.rules ?? []).map((r): [string, SarifRule] => [r.id, r]));
    for (const res of run.results ?? []) {
      if ((res.suppressions ?? []).length > 0) continue;
      const loc = res.locations?.[0]?.physicalLocation;
      const level = res.level ?? rules.get(res.ruleId ?? '')?.defaultConfiguration?.level ?? 'warning';
      out.push({
        rule: res.ruleId ?? 'unknown',
        level: isLevel(level) ? level : 'warning',
        file: loc?.artifactLocation?.uri ?? '?',
        line: loc?.region?.startLine ?? 0,
      });
    }
  }
  return out;
}

export function countBySeverity(findings: Finding[]): Record<Level, number> {
  const c: Record<Level, number> = { error: 0, warning: 0, note: 0, none: 0 };
  for (const f of findings) c[f.level] += 1;
  return c;
}

export function formatTable(findings: Finding[], maxLocations = 3): string {
  if (findings.length === 0) return 'No findings.';
  const groups = new Map<string, Finding & { locations: string[] }>();
  for (const f of findings) {
    const key = `${f.level}\u0000${f.rule}`;
    if (!groups.has(key)) groups.set(key, { ...f, locations: [] });
    groups.get(key)?.locations.push(`${f.file}:${f.line}`);
  }
  const rows = [...groups.values()].sort(
    (a, b) => ORDER[a.level] - ORDER[b.level] || b.locations.length - a.locations.length || a.rule.localeCompare(b.rule),
  );
  const lines = ['| Rule | Severity | Count | Locations |', '|---|---|---|---|'];
  for (const g of rows) {
    const shown = g.locations.slice(0, maxLocations).map((l) => `\`${l}\``).join(', ');
    const more = g.locations.length > maxLocations ? ` +${g.locations.length - maxLocations} more` : '';
    lines.push(`| \`${g.rule}\` | ${LABEL[g.level]} | ${g.locations.length} | ${shown}${more} |`);
  }
  return lines.join('\n');
}

export function formatSummary(findings: Finding[]): string {
  const c = countBySeverity(findings);
  const verdict = c.error > 0 ? `**${c.error} ERROR finding(s): the merge is blocked.**` : 'No ERROR findings: nothing blocks the merge.';
  return [
    '### SAST (Semgrep CE)',
    verdict,
    `ERROR: ${c.error}, WARNING: ${c.warning}, INFO: ${c.note + c.none}. Only ERROR blocks; the rest is reported.`,
    '',
    formatTable(findings),
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: sast-summary.ts <semgrep.sarif>');
    process.exit(2);
  }
  const findings = collectFindings(JSON.parse(readFileSync(file, 'utf8')) as Sarif);
  console.log(formatSummary(findings));
  process.exit(countBySeverity(findings).error > 0 ? 1 : 0);
}
