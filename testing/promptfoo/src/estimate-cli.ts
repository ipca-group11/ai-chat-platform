// Prints what a run costs before it starts and exits 1 when the estimate is above the cap:
//   node testing/promptfoo/src/estimate-cli.ts [--repeat 2]
// Settings: REDTEAM_MODEL (default claude-haiku-4-5), REDTEAM_BUDGET_USD (cap, at most 2), REDTEAM_SURFACES, PAGES_BASE_URL.
import { pathToFileURL } from "node:url";
import { MAX_BUDGET_USD, capFromEnv, estimateRunUsd } from "./budget.ts";
import { selectAttacks } from "./tests.ts";

export function describeEstimate(env: NodeJS.ProcessEnv, repeat: number): { text: string; withinCap: boolean } {
  const model = env["REDTEAM_MODEL"] ?? "claude-haiku-4-5";
  const cap = Math.min(capFromEnv(env), MAX_BUDGET_USD);
  const attacks = selectAttacks(env["REDTEAM_SURFACES"]).filter((a) => !a.knownGap || env["REDTEAM_INCLUDE_GAPS"] === "1");
  const run = estimateRunUsd(attacks, model, repeat, env["PAGES_BASE_URL"]);
  const lines = run.perAttack.map((a) => `  ${a.id.padEnd(4)} ${a.usd.toFixed(4)} USD`);
  const withinCap = run.totalUsd <= cap;
  lines.push(
    `model ${model}, ${attacks.length} attacks x ${repeat} = ${(attacks.length * repeat)} runs`,
    `estimate ${run.totalUsd.toFixed(3)} USD, cap ${cap} USD: ${withinCap ? "within the cap" : "ABOVE THE CAP, the run would stop early"}`,
  );
  return { text: lines.join("\n"), withinCap };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = process.argv.indexOf("--repeat");
  const repeat = index >= 0 ? Number(process.argv[index + 1]) : 1;
  const { text, withinCap } = describeEstimate(process.env, repeat);
  process.stdout.write(`${text}\n`);
  process.exitCode = withinCap ? 0 : 1;
}
