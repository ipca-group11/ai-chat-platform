// Prints the Markdown summary of a promptfoo JSON report: node testing/promptfoo/src/report-cli.ts redteam-results/report.json
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { summarise, toMarkdown, type EvalFile } from "./report.ts";

export function markdownFor(path: string): string {
  try {
    return toMarkdown(summarise(JSON.parse(readFileSync(path, "utf-8")) as EvalFile));
  } catch (error) {
    return `No red-team summary: ${error instanceof Error ? error.message : String(error)}`;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error("usage: report-cli.ts <report.json>");
  process.stdout.write(`${markdownFor(path)}\n`);
}
