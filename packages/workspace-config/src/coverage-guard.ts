import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readRepoFile, readRepoJson, repoRoot } from "./repo.ts";

/**
 * Projects whose `test` target is allowed to skip coverage (AICHAT-34, README §5).
 * Add a project here only with a written reason; everything else must enforce coverage.
 */
export const COVERAGE_EXEMPT: Record<string, string> = {
  "testing/k6": "k6 runtime, not Node: the suite only asserts on the script text, there is no Node source to instrument",
};

/**
 * Projects that are allowed to not import `@platform/test-config` in their Vitest config.
 */
export const PRESET_IMPORT_EXEMPT: Record<string, string> = {
  "packages/test-config": "defines the preset, so it imports it relatively",
  "packages/eslint-config":
    "would create a dependency cycle with @platform/test-config; keeps identical thresholds inline",
};

export interface ProjectInfo {
  dir: string;
  command: string | undefined;
  scriptCommand: string | undefined;
  config: string | undefined;
}

const CONFIG_FILES = ["vitest.config.ts", "vite.config.ts"];

/** Project directories of the pnpm workspace that define a Nx `test` target. */
export function findTestProjects() {
  const dirs: string[] = [];
  for (const group of ["apps", "services", "packages"]) {
    for (const entry of readdirSync(join(repoRoot, group), { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.push(`${group}/${entry.name}`);
    }
  }
  dirs.push("e2e", "testing/k6", "testing/mock-server");
  return dirs.filter((dir) => {
    if (!existsSync(join(repoRoot, dir, "project.json"))) return false;
    return Boolean(readRepoJson(`${dir}/project.json`).targets?.test);
  });
}

/**
 * Returns the list of problems for one project (empty when it is fine).
 * `project` is `{ dir, command, scriptCommand, config }` where `command` is the Nx `test`
 * command, `scriptCommand` the `package.json` `test` script (may be undefined) and `config`
 * the text of the Vitest config (may be undefined).
 */
export function checkProject(project: ProjectInfo, { coverageExempt = COVERAGE_EXEMPT, importExempt = PRESET_IMPORT_EXEMPT } = {}) {
  const { dir, command, scriptCommand, config } = project;
  if (dir in coverageExempt) return [];
  const problems: string[] = [];
  if (!command?.includes("--coverage")) {
    problems.push(`${dir}: the Nx test target "${command}" does not run with --coverage`);
  }
  if (scriptCommand !== undefined && !scriptCommand.includes("--coverage")) {
    problems.push(`${dir}: the package.json test script "${scriptCommand}" does not run with --coverage`);
  }
  if (config === undefined) {
    problems.push(`${dir}: no vitest.config.ts or vite.config.ts found`);
  } else if (!(dir in importExempt) && !config.includes("@platform/test-config")) {
    problems.push(`${dir}: the Vitest config does not import @platform/test-config`);
  }
  return problems;
}

/** Reads the real project files from the repo for the given directory. */
export function loadProject(dir: string) {
  const projectJson = readRepoJson(`${dir}/project.json`);
  const pkgPath = `${dir}/package.json`;
  const scriptCommand = existsSync(join(repoRoot, pkgPath))
    ? readRepoJson(pkgPath).scripts?.test
    : undefined;
  const configFile = CONFIG_FILES.find((file) => existsSync(join(repoRoot, dir, file)));
  return {
    dir,
    command: projectJson.targets.test.options?.command,
    scriptCommand,
    config: configFile ? readRepoFile(`${dir}/${configFile}`) : undefined,
  };
}
