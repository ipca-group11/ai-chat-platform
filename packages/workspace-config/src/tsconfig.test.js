import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readRepoJson, repoRoot } from "./repo.js";

// `packages/tsconfig/node.json` sets `"types": ["node"]`, which needs `@types/node` to be
// resolvable via TS's ambient `typeRoots` lookup. The throwaway project below lives
// outside the workspace's own node_modules, so point `typeRoots` explicitly at the
// `@types` directory already resolvable from `packages/shared-types` (a real consumer of
// `packages/tsconfig`).
const require = createRequire(join(repoRoot, "packages", "shared-types", "package.json"));
const typesRoot = dirname(dirname(require.resolve("@types/node/package.json")));

describe("AC-10: packages/tsconfig provides shared tsconfig bases used by every project", () => {
  it("AC-10: base.json extends the root tsconfig.base.json and enables strict mode", () => {
    const base = readRepoJson("packages/tsconfig/base.json");
    expect(base.extends).toBe("../../tsconfig.base.json");
    expect(base.compilerOptions.strict).toBe(true);
    expect(base.compilerOptions.noEmit).toBe(true);
  });

  it("AC-10: react.json extends base.json and adds DOM/JSX support", () => {
    const react = readRepoJson("packages/tsconfig/react.json");
    expect(react.extends).toBe("./base.json");
    expect(react.compilerOptions.jsx).toBeTruthy();
    expect(react.compilerOptions.lib).toEqual(expect.arrayContaining(["DOM"]));
  });

  it("AC-10: node.json extends base.json and targets Node module resolution", () => {
    const node = readRepoJson("packages/tsconfig/node.json");
    expect(node.extends).toBe("./base.json");
    expect(node.compilerOptions.module).toBe("NodeNext");
    expect(node.compilerOptions.types).toEqual(expect.arrayContaining(["node"]));
  });
});

describe("AC-10: `tsc --noEmit` passes on a project extending each shared tsconfig base", () => {
  let dir;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it.each(["base.json", "react.json", "node.json"])(
    "AC-10: a project extending packages/tsconfig/%s typechecks cleanly",
    (base) => {
      dir = mkdtempSync(join(tmpdir(), "tsconfig-smoke-"));
      writeFileSync(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          extends: join(repoRoot, "packages", "tsconfig", base),
          compilerOptions: { rootDir: dir, typeRoots: [typesRoot] },
          include: ["sample.ts"],
        }),
      );
      writeFileSync(join(dir, "sample.ts"), "export const answer: number = 42;\n");

      expect(() =>
        execFileSync("pnpm", ["exec", "tsc", "--noEmit", "-p", join(dir, "tsconfig.json")], {
          cwd: repoRoot,
          stdio: "pipe",
        }),
      ).not.toThrow();
    },
    20000,
  );
});
