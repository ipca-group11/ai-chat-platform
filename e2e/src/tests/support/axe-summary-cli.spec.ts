import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** The `axe-summary` command (AICHAT-173) on a folder of saved scans. Node only, no browser and no stack. */

const cli = path.resolve(import.meta.dirname, "axe-summary-cli.ts");
const tsx = path.resolve(import.meta.dirname, "../../../node_modules/.bin/tsx");

function summary(reportDir: string): string {
  const run = spawnSync(tsx, [cli], { env: { ...process.env, A11Y_REPORT_DIR: reportDir }, encoding: "utf8" });
  expect(run.status, run.stderr).toBe(0);
  return run.stdout;
}

test("prints the table of the saved scans", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "axe-report-"));
  const violation = { id: "color-contrast", impact: "serious", description: "contrast", nodes: [{ target: ["h1"] }] };
  await writeFile(path.join(dir, "a.json"), JSON.stringify({ label: "login · dark", violations: [violation] }));
  await writeFile(path.join(dir, "b.json"), JSON.stringify({ label: "chat · light", violations: [] }));
  await writeFile(path.join(dir, "notes.txt"), "not a scan");

  const output = summary(dir);
  expect(output).toContain("2 scans, 1 rule with violations");
  expect(output).toContain("| color-contrast | serious | yes | 1 | login · dark |");
});

test("says so when there are no reports", async () => {
  const dir = path.join(await mkdtemp(path.join(tmpdir(), "axe-report-")), "missing");
  expect(summary(dir)).toContain(`No axe reports in ${dir}`);
});
