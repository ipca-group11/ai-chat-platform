// Lists the source files that fall under the unit-test policy (docs/AICHAT-17/UNIT-TEST-POLICY.md)
// and reports which of them have a co-located test or an entry in unit-test-exempt.json.
//
//   node scripts/unit-test/source-files.mjs            # table per project
//   node scripts/unit-test/source-files.mjs --list     # one line per file: status path
//   node scripts/unit-test/source-files.mjs --check    # exit 1 on a stale or invalid exempt entry
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
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
];

export function listSourceFiles() {
  const tracked = execFileSync("git", ["ls-files", "apps", "packages", "services", "e2e"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  return tracked
    .filter((f) => IN_SCOPE.test(f) && EXTENSION.test(f) && !NOT_SOURCE.some((re) => re.test(f)))
    .filter((f) => existsSync(join(root, f)))
    .sort();
}

/** Test files that sit next to `file` (same base name, `.test`/`.spec`). */
export function colocatedTests(file) {
  const base = file.replace(/\.(ts|tsx|js)$/, "");
  return [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".test.js", ".spec.js"]
    .map((ext) => base + ext)
    .filter((f) => existsSync(join(root, f)));
}

export function loadExempt() {
  const data = JSON.parse(readFileSync(join(root, EXEMPT_FILE), "utf8"));
  return data.entries;
}

export function validateExempt(entries, files) {
  const problems = [];
  const seen = new Set();
  for (const e of entries) {
    if (typeof e.path !== "string" || !e.path) problems.push(`entry without a path: ${JSON.stringify(e)}`);
    else if (seen.has(e.path)) problems.push(`${e.path}: listed twice`);
    else seen.add(e.path);
    if (!CATEGORIES.includes(e.category)) problems.push(`${e.path}: category must be one of ${CATEGORIES.join(", ")}`);
    if (typeof e.reason !== "string" || e.reason.trim().length < 10) problems.push(`${e.path}: missing reason`);
    if (!files.includes(e.path)) problems.push(`${e.path}: not a source file in scope (moved, deleted or excluded)`);
    else if (colocatedTests(e.path).length > 0) problems.push(`${e.path}: exempt but has its own test; remove the entry`);
  }
  return problems;
}

function projectOf(file) {
  const [a, b] = file.split("/");
  return a === "e2e" ? "e2e" : `${a}/${b}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = listSourceFiles();
  const entries = loadExempt();
  const exempt = new Set(entries.map((e) => e.path));
  const mode = process.argv[2];
  const status = (f) => (exempt.has(f) ? "exempt" : colocatedTests(f).length ? "tested" : "NO-TEST");
  if (mode === "--list") {
    for (const f of files) console.log(`${status(f).padEnd(8)} ${f}`);
  } else if (mode === "--check") {
    const problems = validateExempt(entries, files);
    problems.forEach((p) => console.error(p));
    console.log(`${files.length} source files, ${entries.length} exempt entries, ${problems.length} problems`);
    process.exit(problems.length ? 1 : 0);
  } else {
    const rows = new Map();
    for (const f of files) {
      const row = rows.get(projectOf(f)) ?? { files: 0, tested: 0, exempt: 0, none: 0 };
      row.files++;
      const s = status(f);
      if (s === "tested") row.tested++;
      else if (s === "exempt") row.exempt++;
      else row.none++;
      rows.set(projectOf(f), row);
    }
    console.log("project".padEnd(34) + "files  own-test  exempt  neither");
    let t = { files: 0, tested: 0, exempt: 0, none: 0 };
    for (const [p, r] of rows) {
      console.log(`${p.padEnd(34)}${String(r.files).padStart(5)}${String(r.tested).padStart(10)}${String(r.exempt).padStart(8)}${String(r.none).padStart(9)}`);
      for (const k of Object.keys(t)) t[k] += r[k];
    }
    console.log(`${"total".padEnd(34)}${String(t.files).padStart(5)}${String(t.tested).padStart(10)}${String(t.exempt).padStart(8)}${String(t.none).padStart(9)}`);
  }
}
