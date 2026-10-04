// Pure helpers of the Lighthouse CI run (AICHAT-62): they turn the committed lighthouserc.json into the config of
// one run (real chat id, session cookie) and summarise the reports. No network, no file access, so they are unit tested.

export interface Assertion {
  maxNumericValue: number;
}

export interface MatrixEntry {
  matchingUrlPattern: string;
  assertions: Record<string, [string, Assertion]>;
}

export interface LhciConfig {
  ci: {
    collect: { url: string[]; numberOfRuns: number; settings: Record<string, unknown> };
    assert: { assertMatrix: MatrixEntry[] };
    upload: { target: string; outputDir: string; reportFilenamePattern?: string };
  };
}

export const CHAT_PLACEHOLDER = '{CHAT_ID}';

/** The access token cookie, the only one the services check, as a `name=value` pair (or an empty string). */
export function accessCookie(setCookies: string[]): string {
  const pair = setCookies.map((line) => line.split(';')[0]?.trim() ?? '').find((p) => p.startsWith('access_token='));
  return pair && !pair.endsWith('=') ? pair : '';
}

/**
 * The config of one run: the placeholder chat id and the origin of the committed URLs are replaced, and the session
 * cookie is set as an extra header of every request. Does not change its input.
 */
export function buildRunConfig(template: LhciConfig, baseUrl: string, chatId: string, cookie: string): LhciConfig {
  const base = baseUrl.replace(/\/$/, '');
  const url = template.ci.collect.url.map((u) =>
    u.replace(CHAT_PLACEHOLDER, chatId).replace(/^https?:\/\/[^/]+/, base),
  );
  return {
    ci: {
      ...template.ci,
      collect: {
        ...template.ci.collect,
        url,
        settings: { ...template.ci.collect.settings, extraHeaders: { Cookie: cookie } },
      },
    },
  };
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] ?? NaN) : ((sorted[mid - 1] ?? NaN) + (sorted[mid] ?? NaN)) / 2;
}

/** The URL as shown in the tables: the chat id becomes `:id`, the origin is dropped. */
export function pageLabel(url: string): string {
  return new URL(url).pathname.replace(/^\/chats\/[^/]+$/, '/chats/:id');
}

export interface Report {
  finalUrl: string;
  lcp: number;
  tbt: number;
  cls: number;
}

export interface PageRow {
  page: string;
  runs: number;
  lcp: number;
  tbt: number;
  cls: number;
  budget: { lcp: number; tbt: number; cls: number } | null;
  pass: boolean;
}

/** The three budgets of the matrix entry whose pattern matches the URL, if any. */
export function budgetFor(url: string, matrix: MatrixEntry[]): PageRow['budget'] {
  const entry = matrix.find((e) => new RegExp(e.matchingUrlPattern).test(url));
  if (!entry) return null;
  const limit = (audit: string): number => entry.assertions[audit]?.[1].maxNumericValue ?? Infinity;
  return { lcp: limit('largest-contentful-paint'), tbt: limit('total-blocking-time'), cls: limit('cumulative-layout-shift') };
}

/** One row per page: the median of its runs against its budget. */
export function summarise(reports: Report[], matrix: MatrixEntry[]): PageRow[] {
  const byUrl = new Map<string, Report[]>();
  for (const report of reports) byUrl.set(report.finalUrl, [...(byUrl.get(report.finalUrl) ?? []), report]);
  return [...byUrl.entries()].map(([url, runs]) => {
    const lcp = median(runs.map((r) => r.lcp));
    const tbt = median(runs.map((r) => r.tbt));
    const cls = median(runs.map((r) => r.cls));
    const budget = budgetFor(url, matrix);
    return {
      page: pageLabel(url),
      runs: runs.length,
      lcp,
      tbt,
      cls,
      budget,
      pass: budget !== null && lcp <= budget.lcp && tbt <= budget.tbt && cls <= budget.cls,
    };
  });
}

const ms = (value: number): string => `${Math.round(value)} ms`;

export function renderMarkdown(rows: PageRow[]): string {
  const lines = [
    '| Page | Runs | LCP median (budget) | TBT median (budget) | CLS median (budget) | Within budget |',
    '|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    const b = row.budget;
    lines.push(
      `| \`${row.page}\` | ${row.runs} | ${ms(row.lcp)} (${b ? ms(b.lcp) : 'none'}) | ${ms(row.tbt)} (${b ? ms(b.tbt) : 'none'}) | ${row.cls.toFixed(3)} (${b ? b.cls : 'none'}) | ${row.pass ? 'yes' : 'no'} |`,
    );
  }
  return lines.join('\n');
}
