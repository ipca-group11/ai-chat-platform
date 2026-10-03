import { resolve } from "node:path";
import { ESLint } from "eslint";

const cwd = `${resolve(import.meta.dirname, "../..")}/`;

/** Lints `code` as if it lived at `file` (relative to this package) and returns the rule ids that fired. */
export async function lintRuleIds(config, code, file = "src/fixture.ts") {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config, cwd });
  const [result] = await eslint.lintText(code, { filePath: `${cwd}${file}` });
  return result.messages.map((m) => m.ruleId);
}
