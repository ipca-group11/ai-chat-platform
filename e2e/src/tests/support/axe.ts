// Named import: the default export's type declaration does not resolve under NodeNext's dual CJS/ESM
// declaration files, although the runtime export works either way.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * AICHAT-10: accessibility scans with axe-core.
 *
 * Only the rules tagged with these WCAG levels run (WCAG 2.2 AA, which includes 2.0 and 2.1 A/AA). Without tags, axe also
 * runs its "best-practice" rules, which are advice rather than a standard.
 */
export const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

export type Impact = "minor" | "moderate" | "serious" | "critical";

/** The part of an axe-core result the checks below read; small so they can be tested without a browser. */
export interface AxeViolation {
  id: string;
  impact?: Impact | null;
  description: string;
  helpUrl?: string;
  nodes: { target: readonly unknown[] }[];
}

export interface AxeResults {
  violations: AxeViolation[];
}

/** Decision of AICHAT-172: these impacts fail the test; `minor` and `moderate` are only reported. */
const blockingImpacts: ReadonlySet<string> = new Set<Impact>(["serious", "critical"]);

export function filterBlockingViolations(results: AxeResults): AxeViolation[] {
  return results.violations.filter((violation) => blockingImpacts.has(violation.impact ?? ""));
}

/** One line per violation: impact, rule, description and the CSS path of every element that fails it. */
export function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.map(String).join(" ")).join(", ");
      return `[${violation.impact}] ${violation.id}: ${violation.description} (${targets})`;
    })
    .join("\n");
}

/** Where the JSON of every scan is written; `e2e.yml` uploads this folder as the `axe-report` artifact. */
export const reportDir = process.env["A11Y_REPORT_DIR"] ?? path.resolve(import.meta.dirname, "../../../axe-report");

/** File name of a scan, from its label: "Login · empty · dark" → "login-empty-dark.json". */
export function reportFileName(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}.json`;
}

/**
 * Waits for the CSS animations that end (a dialog fading in). axe computes contrast from the opacity at the moment it
 * runs, so a half-faded dialog gives false results. Endless ones (spinner, skeleton pulse) would never finish.
 */
export async function waitForAnimations(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

/** A saved scan, as `assertNoCriticalA11yViolations` writes it. */
export interface SavedScan extends AxeResults {
  label: string;
}

/**
 * Markdown table of every violation in a set of saved scans, one row per rule and impact, blocking ones first. Used for
 * the triage (AICHAT-174) and for the summary of the CI job.
 */
export function summarizeScans(scans: SavedScan[]): string {
  const rows = new Map<string, { id: string; impact: string; labels: Set<string>; elements: number }>();
  for (const scan of scans) {
    for (const violation of scan.violations) {
      const impact = violation.impact ?? "none";
      const key = `${violation.id}|${impact}`;
      const row = rows.get(key) ?? { id: violation.id, impact, labels: new Set<string>(), elements: 0 };
      row.labels.add(scan.label);
      row.elements += violation.nodes.length;
      rows.set(key, row);
    }
  }
  const order = ["critical", "serious", "moderate", "minor", "none"];
  const sorted = [...rows.values()].sort((a, b) => order.indexOf(a.impact) - order.indexOf(b.impact) || a.id.localeCompare(b.id));
  const rules = sorted.length === 1 ? "rule" : "rules";
  const header = `${scans.length} scans, ${sorted.length} ${rules} with violations\n\n| Rule | Impact | Blocking | Elements | Scans |\n|---|---|---|---|---|`;
  const lines = sorted.map(
    (row) =>
      `| ${row.id} | ${row.impact} | ${blockingImpacts.has(row.impact) ? "yes" : "no"} | ${row.elements} | ${[...row.labels].sort().join("<br>")} |`,
  );
  return [header, ...lines].join("\n");
}

export interface ScanOptions {
  /** CSS selectors left out of the scan. Every entry needs a reason next to it in the calling test. */
  exclude?: string[];
}

/**
 * Scans the page as it is now, saves the full axe result (all impacts, plus the rules that passed) as JSON in
 * `reportDir` and in the test's report, and fails when a serious or critical violation is found.
 */
export async function assertNoCriticalA11yViolations(
  page: Page,
  testInfo: TestInfo,
  label: string,
  options: ScanOptions = {},
): Promise<void> {
  await waitForAnimations(page);
  const builder = new AxeBuilder({ page }).withTags([...wcagTags]);
  for (const selector of options.exclude ?? []) builder.exclude(selector);
  const results = await builder.analyze();

  const json = JSON.stringify({ label, ...results }, null, 2);
  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, reportFileName(label)), json);
  await testInfo.attach(`axe ${label}`, { body: json, contentType: "application/json" });

  const blocking = filterBlockingViolations(results);
  expect(blocking, `${label}\n${formatViolations(blocking)}`).toEqual([]);
}
