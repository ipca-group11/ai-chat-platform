// Turns the JSON output of `promptfoo eval -o report.json` into a short Markdown table: one row per attack, the checks
// that failed, and the totals. The report holds the answers of the model, never a key or a header.

interface ComponentResult {
  pass?: boolean;
  reason?: string;
  assertion?: { metric?: string };
}

interface EvalRow {
  success?: boolean;
  error?: string | null;
  /** promptfoo: 0 pass, 1 an assertion failed, 2 the provider returned an error. */
  failureReason?: number;
  testCase?: { metadata?: { attack?: string; surface?: string; knownGap?: boolean } };
  vars?: { attack?: string };
  gradingResult?: { componentResults?: ComponentResult[] } | null;
  response?: { output?: string; metadata?: { fetchedUrls?: string[] } } | null;
}

export interface EvalFile {
  results?: { results?: EvalRow[]; stats?: Record<string, number> };
}

export type Verdict = "pass" | "fail" | "error" | "known-gap";

export interface AttackRow {
  attack: string;
  surface: string;
  verdict: Verdict;
  failedChecks: string[];
  detail: string;
}

const KNOWN_GAP = /known gap/i;

/** One row per run of an attack (a repeated attack has several rows). */
export function summarise(file: EvalFile): AttackRow[] {
  const rows = file.results?.results ?? [];
  return rows.map((row): AttackRow => {
    const attack = row.testCase?.metadata?.attack ?? row.vars?.attack ?? "?";
    const surface = row.testCase?.metadata?.surface ?? "?";
    const failed = (row.gradingResult?.componentResults ?? []).filter((c) => c.pass === false);
    const failedChecks = failed.map((c) => c.assertion?.metric ?? "check");
    if (row.failureReason === 2 || (!row.success && !row.gradingResult)) {
      const gap = KNOWN_GAP.test(row.error ?? "");
      return { attack, surface, verdict: gap ? "known-gap" : "error", failedChecks: [], detail: oneLine(row.error ?? "no result") };
    }
    if (row.success) return { attack, surface, verdict: "pass", failedChecks: [], detail: "" };
    return { attack, surface, verdict: "fail", failedChecks, detail: oneLine(failed[0]?.reason ?? "an assertion failed") };
  });
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\|/g, "/").trim().slice(0, 140);
}

export function toMarkdown(rows: AttackRow[]): string {
  const count = (v: Verdict) => rows.filter((r) => r.verdict === v).length;
  const lines = [
    "| Attack | Surface | Result | Failed checks | Detail |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.attack} | ${r.surface} | ${r.verdict} | ${r.failedChecks.join(", ") || "-"} | ${r.detail || "-"} |`),
    "",
    `${rows.length} runs: ${count("pass")} pass, ${count("fail")} fail, ${count("error")} error, ${count("known-gap")} known gap (not counted as a pass).`,
  ];
  return lines.join("\n");
}
