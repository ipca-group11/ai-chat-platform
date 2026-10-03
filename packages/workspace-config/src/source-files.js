// Which source files fall under the unit-test policy (docs/AICHAT-17/UNIT-TEST-POLICY.md), which of
// them have a co-located test, and which are exempt (packages/workspace-config/unit-test-exempt.json).
// Used by the guard test (source-files.test.js) and by scripts/unit-test/source-files.mjs.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./repo.js";

export const EXEMPT_FILE = "packages/workspace-config/unit-test-exempt.json";
export const CATEGORIES = ["bootstrap", "barrel", "type-only"];

const IN_SCOPE = /^(apps\/[^/]+\/src\/|packages\/[^/]+\/|services\/[^/]+\/src\/|e2e\/src\/)/;
const EXTENSION = /\.(ts|tsx|js)$/;
const NOT_SOURCE = [
  /\.(test|spec)\.(ts|tsx|js)$/, // the tests themselves
  /\.d\.ts$/,
  /\.stories\.tsx?$/,
  /(^|\/)routeTree\.gen\.ts$/, // generated
  /(^|\/)@mf-types\//,
  /\/generated\//,
  /(^|\/)\.storybook\//,
  /(^|\/)(vitest|vite|eslint|tailwind|postcss)\.config\.(ts|js)$/, // tool configs
  /(^|\/)(test|test-utils)\//, // test helpers
  /(^|\/)(test-setup|test-fakes|setup|setup-env|setup-no-network)\.ts$/,
  /^packages\/workspace-config\/src\/repo\.js$/, // helper of the repo-structure tests
  /^packages\/test-utils\//, // the shared test helpers are test code themselves (tested, not listed)
  /(^|\/)dist\//, // build output
];

/** Files in git (tracked, or new and not ignored) that the policy applies to, sorted. */
export function listSourceFiles(root = repoRoot) {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "apps", "packages", "services", "e2e"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  )
    .split("\n")
    .filter(Boolean);
  return [...new Set(files)]
    .filter((f) => IN_SCOPE.test(f) && EXTENSION.test(f) && !NOT_SOURCE.some((re) => re.test(f)))
    .filter((f) => existsSync(join(root, f)))
    .sort();
}

/** Test files that sit next to `file` (same base name, `.test`/`.spec`). */
export function colocatedTests(file, root = repoRoot) {
  const base = file.replace(/\.(ts|tsx|js)$/, "");
  return [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".test.js", ".spec.js"]
    .map((ext) => base + ext)
    .filter((f) => existsSync(join(root, f)));
}

export function loadExempt(root = repoRoot) {
  return JSON.parse(readFileSync(join(root, EXEMPT_FILE), "utf8")).entries;
}

/** Problems with the exempt list: bad shape, duplicates, files that are gone, files that now have a test. */
export function validateExempt(entries, files, root = repoRoot) {
  const problems = [];
  const seen = new Set();
  for (const e of entries) {
    if (typeof e.path !== "string" || !e.path) problems.push(`entry without a path: ${JSON.stringify(e)}`);
    else if (seen.has(e.path)) problems.push(`${e.path}: listed twice`);
    else seen.add(e.path);
    if (!CATEGORIES.includes(e.category)) problems.push(`${e.path}: category must be one of ${CATEGORIES.join(", ")}`);
    if (typeof e.reason !== "string" || e.reason.trim().length < 10) problems.push(`${e.path}: missing reason`);
    if (typeof e.path !== "string" || !e.path) continue;
    if (!existsSync(join(root, e.path))) problems.push(`${e.path}: exempt entry for a file that no longer exists; remove the entry`);
    else if (!files.includes(e.path)) problems.push(`${e.path}: not a source file in scope (moved or excluded); remove the entry`);
    else if (colocatedTests(e.path, root).length > 0) problems.push(`${e.path}: exempt but has its own test; remove the entry`);
  }
  return problems;
}

/** Source files with neither a co-located test nor an exempt entry. */
export function untestedFiles(files, entries, root = repoRoot) {
  const exempt = new Set(entries.map((e) => e.path));
  return files.filter((f) => !exempt.has(f) && colocatedTests(f, root).length === 0);
}

/** Everything the guard fails on, as readable lines. Empty means the policy holds. */
export function guardProblems(root = repoRoot) {
  const files = listSourceFiles(root);
  const entries = loadExempt(root);
  return [
    ...untestedFiles(files, entries, root).map(
      (f) => `${f}: no unit test and no entry in ${EXEMPT_FILE}; add a test next to it (or an exempt entry if it qualifies)`,
    ),
    ...validateExempt(entries, files, root),
  ];
}

export function fileStatus(file, entries, root = repoRoot) {
  if (entries.some((e) => e.path === file)) return "exempt";
  return colocatedTests(file, root).length ? "tested" : "NO-TEST";
}
