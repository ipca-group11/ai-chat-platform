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

// ---------------------------------------------------------------------------
// Threshold floors (NFR cov-guard-floor): no project may lower its coverage threshold
// below the approved value. Run with `pnpm nx test workspace-config -- coverage-guard`.
// ---------------------------------------------------------------------------

export type ThresholdKey = "lines" | "statements" | "functions" | "branches";
export type Thresholds = Partial<Record<ThresholdKey, number>>;

const THRESHOLD_KEYS: ThresholdKey[] = ["lines", "statements", "functions", "branches"];

/** Approved floors: 80 lines/functions/statements everywhere; branches 80 default, 75 apps, 70 e2e. */
export const DEFAULT_FLOOR: Record<ThresholdKey, number> = { lines: 80, statements: 80, functions: 80, branches: 80 };
export const APP_FLOOR: Record<ThresholdKey, number> = { ...DEFAULT_FLOOR, branches: 75 };
export const E2E_FLOOR: Record<ThresholdKey, number> = { ...DEFAULT_FLOOR, branches: 70 };

/** Approved floor for a project directory. */
export function floorFor(dir: string): Record<ThresholdKey, number> {
  if (dir === "e2e") return E2E_FLOOR;
  if (dir.startsWith("apps/") || dir === "packages/test-utils") return APP_FLOOR;
  return DEFAULT_FLOOR;
}

/** Named threshold constants exported by `@platform/test-config` (kept in sync by checkSharedConstants). */
const NAMED: Record<string, Record<ThresholdKey, number>> = {
  coverageThresholds: DEFAULT_FLOOR,
  appCoverageThresholds: APP_FLOOR,
  e2eCoverageThresholds: E2E_FLOOR,
};

/**
 * Statically resolves the effective thresholds of a Vitest config text.
 * Returns undefined keys when a value cannot be determined (reported as a problem by the checker).
 * `coveragePreset(...)` without overrides inherits the shared 80 default.
 */
export function resolveThresholds(config: string, shared: Record<string, Thresholds> = NAMED): Thresholds {
  const usesPreset = config.includes("coveragePreset(");
  const idx = config.search(/\bthresholds\s*:/);
  if (idx === -1) return usesPreset ? { ...(shared.coverageThresholds ?? DEFAULT_FLOOR) } : {};
  let rest = config.slice(idx).replace(/^thresholds\s*:\s*/, "");
  const result: Thresholds = usesPreset ? { ...(shared.coverageThresholds ?? DEFAULT_FLOOR) } : {};
  if (rest.startsWith("{")) {
    let depth = 0;
    let end = 0;
    for (; end < rest.length; end++) {
      if (rest[end] === "{") depth++;
      else if (rest[end] === "}" && --depth === 0) break;
    }
    const body = rest.slice(1, end);
    for (const spread of body.matchAll(/\.\.\.\s*(\w+)/g)) Object.assign(result, shared[spread[1]!] ?? {});
    for (const key of THRESHOLD_KEYS) {
      const m = new RegExp(`\\b${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(body);
      if (m) result[key] = Number(m[1]);
      else if (new RegExp(`\\b${key}\\s*:`).test(body)) delete result[key]; // non-literal value: unknown
    }
    return result;
  }
  rest = rest.trimStart();
  const ident = /^(\w+)/.exec(rest)?.[1];
  if (ident && shared[ident]) return { ...shared[ident] };
  return {}; // unknown expression
}

/** Problems for one project: any threshold below the approved floor (or not statically determinable). */
export function checkThresholds(dir: string, config: string | undefined, shared: Record<string, Thresholds> = NAMED): string[] {
  if (dir in COVERAGE_EXEMPT || config === undefined) return [];
  const floor = floorFor(dir);
  const actual = resolveThresholds(config, shared);
  const problems: string[] = [];
  for (const key of THRESHOLD_KEYS) {
    const value = actual[key];
    if (typeof value !== "number") {
      problems.push(`${dir}: coverage threshold "${key}" is not set or cannot be resolved (approved >= ${floor[key]})`);
    } else if (value < floor[key]) {
      problems.push(`${dir}: coverage threshold ${key}=${value} is below the approved ${floor[key]}`);
    }
  }
  return problems;
}

/** Problems for the shared threshold constants in packages/test-config/coverage-thresholds.ts. */
export function checkSharedConstants(source = readRepoFile("packages/test-config/coverage-thresholds.ts")): string[] {
  const problems: string[] = [];
  const expected: Record<string, Record<ThresholdKey, number>> = {
    coverageThresholds: DEFAULT_FLOOR,
    appCoverageThresholds: APP_FLOOR,
    e2eCoverageThresholds: E2E_FLOOR,
  };
  for (const [name, floor] of Object.entries(expected)) {
    const block = new RegExp(`${name}\\s*=\\s*Object\\.freeze<[^>]+>\\(\\{([^}]*)\\}`).exec(source)?.[1];
    if (block === undefined) {
      problems.push(`${name}: constant not found in coverage-thresholds.ts`);
      continue;
    }
    for (const key of THRESHOLD_KEYS) {
      const m = new RegExp(`\\b${key}\\s*:\\s*(\\d+(?:\\.\\d+)?)`).exec(block);
      if (!m || Number(m[1]) < floor[key]) {
        problems.push(`${name}.${key}=${m?.[1] ?? "missing"} is below the approved ${floor[key]}`);
      }
    }
  }
  return problems;
}

/** All threshold problems across the workspace (empty when nothing was lowered). */
export function findThresholdViolations(): string[] {
  return [
    ...checkSharedConstants(),
    ...findTestProjects().flatMap((dir) => checkThresholds(dir, loadProject(dir).config)),
  ];
}

// CLI: `node packages/workspace-config/src/coverage-guard.ts` exits 1 on any violation.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const violations = findThresholdViolations();
  for (const v of violations) console.error(v);
  process.exit(violations.length ? 1 : 0);
}
