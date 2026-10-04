import { resolve } from "node:path";
import { ESLint } from "eslint";
import type { Linter } from "eslint";
import type { ConfigArray } from "typescript-eslint";

const cwd = `${resolve(import.meta.dirname, "../..")}/`;

/** Lints `code` as if it lived at `file` (relative to this package) and returns the rule ids that fired. */
export async function lintRuleIds(
  config: ConfigArray,
  code: string,
  file = "src/fixture.ts",
): Promise<Array<string | null>> {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config as Linter.Config[], cwd });
  const [result] = await eslint.lintText(code, { filePath: `${cwd}${file}` });
  if (!result) throw new Error("ESLint returned no result");
  return result.messages.map((m) => m.ruleId);
}
