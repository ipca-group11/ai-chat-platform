#!/usr/bin/env node
/**
 * Prints a Markdown table of the violations in the axe reports of the last run (AICHAT-10):
 * `pnpm --filter e2e run axe-summary`. CI appends it to the job summary.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { reportDir, summarizeScans, type SavedScan } from "./axe.js";

const files = (await readdir(reportDir).catch(() => [])).filter((name) => name.endsWith(".json"));
const scans = await Promise.all(
  files.map(async (name) => JSON.parse(await readFile(path.join(reportDir, name), "utf8")) as SavedScan),
);
console.log(files.length ? summarizeScans(scans) : `No axe reports in ${reportDir}`);
