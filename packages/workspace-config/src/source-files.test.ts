import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  EXEMPT_FILE,
  colocatedTests,
  guardProblems,
  listSourceFiles,
  loadExempt,
  untestedFiles,
  validateExempt,
} from "./source-files.ts";

// The guard (AICHAT-138): every source file under the unit-test policy has a test next to it
// or an entry in unit-test-exempt.json, and every exempt entry still points at a file that needs it.
describe("unit-test guard on this repository", () => {
  it("finds no source file without a test or an exempt entry, and no stale exempt entry", () => {
    expect(guardProblems()).toEqual([]);
  });

  it("lists the same kind of files as the inventory", () => {
    const files = listSourceFiles();
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain("apps/mfe-chat/src/shared/model-capabilities.ts");
    expect(files).not.toContain("apps/mfe-chat/src/shared/model-capabilities.test.ts");
    expect(files.filter((f: string) => f.endsWith(".d.ts") || f.includes("/generated/"))).toEqual([]);
  });
});

describe("the rules, on a scratch repository", () => {
  const root = mkdtempSync(join(tmpdir(), "unit-guard-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const write = (rel: string, content: string = "export {};\n") => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  };
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  const exempt = (...entries: object[]) =>
    write(EXEMPT_FILE, JSON.stringify({ version: 1, entries }));
  const entry = (path: string) => ({ path, category: "barrel", reason: "Only re-exports, no logic." });

  git("init", "-q");
  write("apps/demo/src/tested.ts");
  write("apps/demo/src/tested.test.ts");
  write("apps/demo/src/untested.ts");
  write("apps/demo/src/index.ts");
  write("apps/demo/src/types.d.ts");
  write("apps/demo/src/button.stories.tsx");
  write("apps/demo/src/stories-support.tsx");
  write("apps/demo/README.md", "# demo\n");
  write("services/api/src/handler.ts");
  write("services/api/src/handler.spec.ts");
  write("services/api/tooling/script.ts");

  it("lists source files only: no tests, declarations, stories, docs or files outside the roots", () => {
    expect(listSourceFiles(root)).toEqual([
      "apps/demo/src/index.ts",
      "apps/demo/src/tested.ts",
      "apps/demo/src/untested.ts",
      "services/api/src/handler.ts",
    ]);
  });

  it("finds a test next to the file (.test or .spec)", () => {
    expect(colocatedTests("apps/demo/src/tested.ts", root)).toEqual(["apps/demo/src/tested.test.ts"]);
    expect(colocatedTests("services/api/src/handler.ts", root)).toEqual(["services/api/src/handler.spec.ts"]);
    expect(colocatedTests("apps/demo/src/untested.ts", root)).toEqual([]);
  });

  it("fails on a file with no test and no exempt entry", () => {
    exempt(entry("apps/demo/src/index.ts"));
    expect(guardProblems(root)).toEqual([
      expect.stringMatching(/^apps\/demo\/src\/untested\.ts: no unit test and no entry in /),
    ]);
  });

  it("passes once the file is exempt, and the exempt file counts as covered", () => {
    exempt(entry("apps/demo/src/index.ts"), entry("apps/demo/src/untested.ts"));
    expect(guardProblems(root)).toEqual([]);
    expect(untestedFiles(listSourceFiles(root), loadExempt(root), root)).toEqual([]);
  });

  it("fails on an exempt entry whose file no longer exists", () => {
    exempt(entry("apps/demo/src/index.ts"), entry("apps/demo/src/untested.ts"), entry("apps/demo/src/gone.ts"));
    expect(guardProblems(root)).toEqual(["apps/demo/src/gone.ts: exempt entry for a file that no longer exists; remove the entry"]);
  });

  it("fails on an exempt entry for a file that has a test now", () => {
    exempt(entry("apps/demo/src/index.ts"), entry("apps/demo/src/untested.ts"), entry("apps/demo/src/tested.ts"));
    expect(guardProblems(root)).toEqual(["apps/demo/src/tested.ts: exempt but has its own test; remove the entry"]);
  });

  it("fails on an exempt entry for a file the policy does not cover", () => {
    exempt(entry("apps/demo/src/index.ts"), entry("apps/demo/src/untested.ts"), entry("apps/demo/src/types.d.ts"));
    expect(guardProblems(root)).toEqual([expect.stringMatching(/^apps\/demo\/src\/types\.d\.ts: not a source file in scope/)]);
  });

  it("rejects malformed entries: duplicate, unknown category, missing reason, no path", () => {
    const problems = validateExempt(
      [
        entry("apps/demo/src/index.ts"),
        entry("apps/demo/src/index.ts"),
        { path: "apps/demo/src/untested.ts", category: "other", reason: "short" },
        { category: "barrel", reason: "Only re-exports, no logic." },
      ],
      listSourceFiles(root),
      root,
    );
    expect(problems).toEqual(
      expect.arrayContaining([
        "apps/demo/src/index.ts: listed twice",
        expect.stringContaining("apps/demo/src/untested.ts: category must be one of"),
        "apps/demo/src/untested.ts: missing reason",
        expect.stringContaining("entry without a path"),
      ]),
    );
  });

  it("sees a new file that git does not track yet", () => {
    exempt(entry("apps/demo/src/index.ts"), entry("apps/demo/src/untested.ts"));
    write("apps/demo/src/fresh.ts");
    expect(guardProblems(root)).toEqual([expect.stringMatching(/^apps\/demo\/src\/fresh\.ts: no unit test/)]);
  });
});
