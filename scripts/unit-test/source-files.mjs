// Lists the source files that fall under the unit-test policy (docs/AICHAT-17/UNIT-TEST-POLICY.md)
// and reports which of them have a co-located test or an entry in unit-test-exempt.json.
// The rules live in packages/workspace-config/src/source-files.js (also run as a test in CI).
//
//   node scripts/unit-test/source-files.mjs            # table per project
//   node scripts/unit-test/source-files.mjs --list     # one line per file: status path
//   node scripts/unit-test/source-files.mjs --check    # exit 1 on an untested file or a stale or invalid exempt entry
import { fileURLToPath } from "node:url";
import {
  EXEMPT_FILE,
  CATEGORIES,
  listSourceFiles,
  colocatedTests,
  loadExempt,
  validateExempt,
  untestedFiles,
  fileStatus,
} from "../../packages/workspace-config/src/source-files.js";

export { EXEMPT_FILE, CATEGORIES, listSourceFiles, colocatedTests, loadExempt, validateExempt };

function projectOf(file) {
  const [a, b] = file.split("/");
  return a === "e2e" ? "e2e" : `${a}/${b}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = listSourceFiles();
  const entries = loadExempt();
  const mode = process.argv[2];
  const status = (f) => fileStatus(f, entries);
  if (mode === "--list") {
    for (const f of files) console.log(`${status(f).padEnd(8)} ${f}`);
  } else if (mode === "--check") {
    const problems = [...untestedFiles(files, entries).map((f) => `${f}: no unit test and no exempt entry`), ...validateExempt(entries, files)];
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
