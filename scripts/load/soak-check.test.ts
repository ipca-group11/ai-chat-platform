import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkDone, checkLength, checkMemory, median, parseCsv, runChecks } from "./soak-check.ts";

const HEADER = "timestamp,container,cpu_pct,cpu_limit_cores,mem_mib,mem_limit_mib,mem_pct,net_rx_mb,net_tx_mb,pids";

/** 31 minutes, one sample a minute, memory = f(minute). */
function csv(f: (minute: number) => number, container = "llm-chat-a-1"): string {
  const lines = [HEADER];
  for (let m = 0; m <= 31; m++) {
    const t = new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();
    lines.push(`${t},${container},1.00,0.50,${f(m).toFixed(2)},512.00,0,0,0,5`);
  }
  return lines.join("\n");
}
const summary = (passes: number, fails: number) => ({ metrics: { stream_success_rate: { passes, fails } } });

describe("soak-check", () => {
  it("median handles odd, even and empty", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([]), 0);
  });

  it("done: passes above 99% and fails at or below", () => {
    assert.equal(checkDone(summary(995, 5), 0.99).ok, true);
    assert.equal(checkDone(summary(99, 1), 0.99).ok, false);
    assert.equal(checkDone({ metrics: {} }, 0.99).ok, false);
  });

  it("memory: flat passes, 20% growth fails, noise is ignored by the median", () => {
    assert.ok(checkMemory(parseCsv(csv(() => 100)), 10, 0.1).every((c) => c.ok));
    const leak = checkMemory(parseCsv(csv((m) => 100 + m * (20 / 31))), 10, 0.1);
    assert.equal(leak[0]?.ok, false);
    const spike = checkMemory(parseCsv(csv((m) => (m === 31 ? 300 : 100))), 10, 0.1);
    assert.equal(spike[0]?.ok, true);
  });

  it("length: a short run fails", () => {
    const short = parseCsv(csv(() => 100).split("\n").slice(0, 6).join("\n"));
    assert.equal(checkLength(short, 29).ok, false);
    assert.equal(checkLength(parseCsv(csv(() => 100)), 29).ok, true);
  });

  it("runChecks fails overall on a leak and passes on a healthy run", () => {
    assert.ok(runChecks(summary(1000, 0), csv(() => 100)).every((c) => c.ok));
    assert.ok(runChecks(summary(1000, 0), csv((m) => 100 + m * 2)).some((c) => !c.ok));
  });
});
