#!/usr/bin/env node
// Reads the JSON report of a ZAP scan (zap-baseline.py -J / zap-api-scan.py -J), prints a Markdown summary and
// sets the exit code, so the CI job and a person at a terminal judge a scan the same way.
//   node scripts/dast/zap-report.ts zap-results/report.json [--expect /chats,/settings] [--fail-on high|medium]
//   node scripts/dast/zap-report.ts zap-results/report.json --urls        lists the URLs of the report and exits
// Exit 1: an expected URL is missing from the report, or --fail-on is given and an alert at or above it exists.
// Without --fail-on the exit code of zap-baseline.py decides (rules.tsv: FAIL), so an alert ignored on purpose never fails.
// Dependency-free on purpose: it runs on a plain runner before any `pnpm install`.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export interface ZapInstance {
  uri: string;
  method?: string;
}

export interface ZapAlert {
  pluginid: string;
  alert?: string;
  name?: string;
  riskcode: string;
  instances?: ZapInstance[];
}

export interface ZapReport {
  site?: Array<{ '@name'?: string; alerts?: ZapAlert[] }>;
}

export type Risk = 'High' | 'Medium' | 'Low' | 'Informational';

const RISKS: Risk[] = ['High', 'Medium', 'Low', 'Informational'];
/** ZAP's riskcode: 3 High, 2 Medium, 1 Low, 0 Informational. */
const riskOf = (alert: ZapAlert): Risk => RISKS[3 - Number(alert.riskcode)] ?? 'Informational';

/** The alerts of all sites. An alert whose every URL is out of scope (OUTOFSCOPE in rules.tsv) has no instance left and is dropped. */
export function collectAlerts(report: ZapReport): ZapAlert[] {
  return (report.site ?? []).flatMap((site) => site.alerts ?? []).filter((alert) => alert.instances === undefined || alert.instances.length > 0);
}

export function countByRisk(alerts: ZapAlert[]): Record<Risk, number> {
  const counts: Record<Risk, number> = { High: 0, Medium: 0, Low: 0, Informational: 0 };
  for (const alert of alerts) counts[riskOf(alert)] += 1;
  return counts;
}

/** Alerts at `threshold` risk or above (High only by default). */
export function failingAlerts(alerts: ZapAlert[], threshold: 'high' | 'medium' = 'high'): ZapAlert[] {
  const minimum = threshold === 'high' ? 3 : 2;
  return alerts.filter((alert) => Number(alert.riskcode) >= minimum);
}

/** Every URL listed in the report, without the query string. */
export function reportedUrls(alerts: ZapAlert[]): string[] {
  const urls = new Set<string>();
  for (const alert of alerts) for (const instance of alert.instances ?? []) urls.add(instance.uri.split('?')[0] ?? instance.uri);
  return [...urls].sort();
}

/** The expected path fragments (for example `/chats`) that no URL in the report starts with. */
export function missingUrls(alerts: ZapAlert[], expected: string[]): string[] {
  const urls = reportedUrls(alerts);
  return expected.filter((fragment) => !urls.some((url) => new URL(url).pathname.startsWith(fragment)));
}

export function formatTable(alerts: ZapAlert[]): string {
  if (alerts.length === 0) return '_No alerts._';
  const rows = [...alerts]
    .sort((a, b) => Number(b.riskcode) - Number(a.riskcode) || a.pluginid.localeCompare(b.pluginid, undefined, { numeric: true }))
    .map((a) => `| ${a.pluginid} | ${a.name ?? a.alert ?? ''} | ${riskOf(a)} | ${a.instances?.length ?? 0} |`);
  return ['| Rule | Alert | Risk | URLs |', '|---|---|---|---|', ...rows].join('\n');
}

/** The Markdown summary. The report lists every alert, also those rules.tsv ignores, so the counts are not the verdict. */
export function formatSummary(report: ZapReport): string {
  const alerts = collectAlerts(report);
  const counts = countByRisk(alerts);
  const high = counts.High > 0 ? `**${counts.High} High alert(s) in the report.** Unless rules.tsv ignores them with a reason, they fail the job.` : 'No High alerts in the report.';
  return [
    '### DAST (OWASP ZAP)',
    high,
    `High: ${counts.High}, Medium: ${counts.Medium}, Low: ${counts.Low}, Informational: ${counts.Informational}. Rules set to FAIL in rules.tsv fail the job; WARN is reported.`,
    '',
    formatTable(alerts),
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name: string): string | undefined => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : undefined;
  };
  const file = args.find((a) => !a.startsWith('--') && a !== option('--expect') && a !== option('--fail-on'));
  if (!file) {
    console.error('usage: zap-report.ts <report.json> [--expect /chats,/settings] [--fail-on high|medium]');
    process.exit(2);
  }
  if (args.includes('--urls')) {
    console.log(reportedUrls(collectAlerts(JSON.parse(readFileSync(file, 'utf8')) as ZapReport)).join('\n'));
    process.exit(0);
  }
  const failOn = option('--fail-on');
  const threshold = failOn === 'medium' ? 'medium' : 'high';
  const report = JSON.parse(readFileSync(file, 'utf8')) as ZapReport;
  const alerts = collectAlerts(report);
  console.log(formatSummary(report));
  const expected = (option('--expect') ?? '').split(',').filter(Boolean);
  const missing = missingUrls(alerts, expected);
  if (expected.length > 0) {
    console.log(missing.length === 0 ? `\nExpected URLs present: ${expected.join(', ')}` : `\n**Missing from the report: ${missing.join(', ')}** (the scan did not see the signed-in pages).`);
  }
  process.exit((failOn !== undefined && failingAlerts(alerts, threshold).length > 0) || missing.length > 0 ? 1 : 0);
}
