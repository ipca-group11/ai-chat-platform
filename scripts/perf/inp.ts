// Pure helpers of the INP check (AICHAT-240, scripts/perf/inp-check.ts): turn the input events recorded in the page
// (with their time to the next frame) into an INP value per run, and the runs into a median per page against the budget. No browser, no network.

/** One input event and its time to the next frame; events of one interaction share `interactionId` (0: none). */
export interface EventEntry {
  name: string;
  interactionId: number;
  duration: number;
  /** Element the event was dispatched to (tag and aria-label), for the log. */
  target?: string;
}

/** INP budget (field p75 "good" threshold, approved in AICHAT-45 / docs/AICHAT-21 US1). */
export const INP_BUDGET_MS = 200;

/**
 * INP of one visit, as web-vitals computes it: the longest event of each interaction (entries with the same
 * `interactionId`), then the worst interaction, ignoring one per 50 interactions (the p98 rule for long visits).
 * Entries without an interaction id (hover, scroll) do not count. Returns 0 when there was no interaction.
 */
export function inpOf(entries: EventEntry[]): number {
  const longest = new Map<number, number>();
  for (const entry of entries) {
    if (!entry.interactionId) continue;
    longest.set(entry.interactionId, Math.max(longest.get(entry.interactionId) ?? 0, entry.duration));
  }
  const sorted = [...longest.values()].sort((a, b) => b - a);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length / 50))] ?? 0;
}

/** Number of distinct interactions in the entries. */
export function interactionCount(entries: EventEntry[]): number {
  return new Set(entries.filter((e) => e.interactionId).map((e) => e.interactionId)).size;
}

export interface InpRun {
  page: string;
  inp: number;
  interactions: number;
}

export interface InpRow {
  page: string;
  median: number;
  runs: number[];
  interactions: number;
  pass: boolean;
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] ?? NaN) : ((sorted[mid - 1] ?? NaN) + (sorted[mid] ?? NaN)) / 2;
}

/**
 * Median INP per page over the runs, in the order the pages first appear. A page fails when its median is over the
 * budget or when a run recorded no interaction at all (the scenario no longer reaches the page's controls).
 */
export function summarise(runs: InpRun[], budget = INP_BUDGET_MS): InpRow[] {
  const pages = [...new Set(runs.map((r) => r.page))];
  return pages.map((page) => {
    const own = runs.filter((r) => r.page === page);
    const value = median(own.map((r) => r.inp));
    const interactions = Math.min(...own.map((r) => r.interactions));
    return { page, median: value, runs: own.map((r) => r.inp), interactions, pass: interactions > 0 && value <= budget };
  });
}

export function renderMarkdown(rows: InpRow[], budget = INP_BUDGET_MS, cpuThrottle = 1): string {
  const lines = [
    `## INP: median of ${rows[0]?.runs.length ?? 0} runs per page (CPU throttle ${cpuThrottle}x)`,
    '',
    '| Page | INP median (budget) | Runs (ms) | Interactions | Result |',
    '| --- | ---: | --- | ---: | --- |',
    ...rows.map(
      (r) =>
        `| \`${r.page}\` | ${Math.round(r.median)} ms (${budget} ms) | ${r.runs.map((v) => Math.round(v)).join(', ')} | ${r.interactions} | ${r.pass ? 'pass' : 'FAIL'} |`,
    ),
  ];
  return `${lines.join('\n')}\n`;
}
