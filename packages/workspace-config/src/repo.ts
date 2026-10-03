import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

// `packages/workspace-config/src/repo.ts` -> repo root is three levels up.
const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "..", "..", "..");

/** Reads a file relative to the repo root, throwing a clear error if it's missing. */
export function readRepoFile(relPath: string): string {
  const absPath = join(repoRoot, relPath);
  try {
    return readFileSync(absPath, "utf8");
  } catch (error) {
    throw new Error(`Expected repo file "${relPath}" to exist at ${absPath}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

/** Reads and `JSON.parse`s a file relative to the repo root. */
// Repo config files have arbitrary shapes that the tests assert on, so the parsed value is untyped.
export function readRepoJson(relPath: string): any {
  return JSON.parse(readRepoFile(relPath));
}
