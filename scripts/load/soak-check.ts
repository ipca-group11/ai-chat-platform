#!/usr/bin/env node
// Soak gate (load-soak-30): fails when the 30 min soak run breaks the thresholds.
//
//   node scripts/load/soak-check.ts [--summary docs/AICHAT-24/results/soak-summary.json] \
//     [--stats docs/AICHAT-24/results/soak-docker-stats.csv] [--min-done 0.99] [--max-growth 10] \
//     [--min-minutes 29] [--window 0.1]
//
// Checks (exit 1 when any fails):
//   done     stream_success_rate from the k6 summary: passes / (passes + fails) > min-done
//   memory   per container: median mem_mib of the last window vs the first window of samples,
//            growth = (end - start) / start * 100 < max-growth
//   length   the sampler covered at least min-minutes (a short run cannot show a slow leak)

import { readFileSync } from "node:fs";

export interface Thresholds {
  minDone: number;
  maxGrowthPct: number;
  minMinutes: number;
  window: number;
}

export const DEFAULTS: Thresholds = { minDone: 0.99, maxGrowthPct: 10, minMinutes: 29, window: 0.1 };

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

interface Row {
  time: number;
  container: string;
  memMiB: number;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Rows of the sampler CSV (header: timestamp,container,cpu_pct,cpu_limit_cores,mem_mib,...). */
export function parseCsv(text: string): Row[] {
  const rows: Row[] = [];
  for (const line of text.split("\n").slice(1)) {
    const cols = line.trim().split(",");
    if (cols.length < 5) continue;
    const time = Date.parse(cols[0] ?? "");
    const memMiB = Number(cols[4]);
    if (Number.isNaN(time) || Number.isNaN(memMiB) || !cols[1]) continue;
    rows.push({ time, container: cols[1], memMiB });
  }
  return rows;
}

export function checkDone(summary: unknown, minDone: number): Check {
  const metric = (summary as { metrics?: Record<string, { passes?: number; fails?: number }> }).metrics?.["stream_success_rate"];
  const passes = metric?.passes ?? 0;
  const fails = metric?.fails ?? 0;
  const total = passes + fails;
  if (total === 0) return { name: "done", ok: false, detail: "no stream_success_rate samples in the k6 summary" };
  const rate = passes / total;
  return { name: "done", ok: rate > minDone, detail: `${(rate * 100).toFixed(2)}% of ${total} streams done (need > ${minDone * 100}%)` };
}

export function checkMemory(rows: Row[], maxGrowthPct: number, window: number): Check[] {
  const byContainer = new Map<string, Row[]>();
  for (const row of rows) byContainer.set(row.container, [...(byContainer.get(row.container) ?? []), row]);
  if (byContainer.size === 0) return [{ name: "memory", ok: false, detail: "no samples in the docker stats CSV" }];
  const checks: Check[] = [];
  for (const [container, list] of [...byContainer].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = list.sort((a, b) => a.time - b.time);
    const size = Math.max(3, Math.floor(sorted.length * window));
    if (sorted.length < size * 2) {
      checks.push({ name: `memory ${container}`, ok: false, detail: `only ${sorted.length} samples, need ${size * 2}` });
      continue;
    }
    const start = median(sorted.slice(0, size).map((r) => r.memMiB));
    const end = median(sorted.slice(-size).map((r) => r.memMiB));
    const growth = start > 0 ? ((end - start) / start) * 100 : end > 0 ? Infinity : 0;
    checks.push({
      name: `memory ${container}`,
      ok: growth < maxGrowthPct,
      detail: `${start.toFixed(1)} -> ${end.toFixed(1)} MiB, growth ${growth.toFixed(1)}% (need < ${maxGrowthPct}%)`,
    });
  }
  return checks;
}

export function checkLength(rows: Row[], minMinutes: number): Check {
  const times = rows.map((r) => r.time);
  const minutes = times.length ? (Math.max(...times) - Math.min(...times)) / 60_000 : 0;
  return { name: "length", ok: minutes >= minMinutes, detail: `sampled ${minutes.toFixed(1)} min (need >= ${minMinutes})` };
}

export function runChecks(summary: unknown, csv: string, t: Thresholds = DEFAULTS): Check[] {
  const rows = parseCsv(csv);
  return [checkDone(summary, t.minDone), checkLength(rows, t.minMinutes), ...checkMemory(rows, t.maxGrowthPct, t.window)];
}

function option(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
}

function main(): void {
  const args = process.argv.slice(2);
  const dir = "docs/AICHAT-24/results";
  const name = process.env["RUN_NAME"] || "soak";
  const summaryFile = option(args, "summary", `${dir}/${name}-summary.json`);
  const statsFile = option(args, "stats", `${dir}/${name}-docker-stats.csv`);
  const thresholds: Thresholds = {
    minDone: Number(option(args, "min-done", String(DEFAULTS.minDone))),
    maxGrowthPct: Number(option(args, "max-growth", String(DEFAULTS.maxGrowthPct))),
    minMinutes: Number(option(args, "min-minutes", String(DEFAULTS.minMinutes))),
    window: Number(option(args, "window", String(DEFAULTS.window))),
  };
  const checks = runChecks(JSON.parse(readFileSync(summaryFile, "utf8")), readFileSync(statsFile, "utf8"), thresholds);
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name}: ${c.detail}`);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(failed ? `soak check FAILED (${failed} of ${checks.length})` : `soak check passed (${checks.length} checks)`);
  process.exit(failed ? 1 : 0);
}

if (import.meta.main) main();
