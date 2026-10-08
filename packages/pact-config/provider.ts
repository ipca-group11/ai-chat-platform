import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pactDir } from "./consumer.js";

/**
 * Every pact file written for `provider` (`<consumer>-<provider>.json` in `pactDir()`).
 * Throws when there is none: a verification that finds no pact would pass without
 * checking anything, so in CI it must mean "the consumer job did not run".
 */
export function pactFilesFor(provider: string, dir: string = pactDir()): string[] {
  const suffix = `-${provider}.json`;
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(suffix)) : [];
  if (files.length === 0) {
    throw new Error(`no pact files for ${provider} in ${dir}: run the consumer tests first (nx run-many -t pact:consumer)`);
  }
  return files.sort().map((f) => join(dir, f));
}

/** An interaction the provider is known not to honour yet, tracked by a Jira issue. */
export interface KnownFailure {
  consumer: string;
  /** The interaction's `uponReceiving` text. */
  description: string;
  /** Jira key of the defect, e.g. `AICHAT-255`. */
  issue: string;
}

export interface SplitPacts {
  /** Copies of the pact files without the known failures: these must verify. */
  verify: string[];
  /** One single-interaction pact file per known failure: each must fail verification. */
  expectedToFail: { failure: KnownFailure; file: string }[];
}

interface PactFile {
  consumer: { name: string };
  interactions: { description: string }[];
}

/**
 * Splits the pact files so known defects do not hide new ones. Every other interaction is
 * verified as usual, and each known failure is verified on its own and must still fail:
 * once its defect is fixed the run says so, and the entry has to be removed from the list.
 * Throws when a listed failure matches no interaction (a stale or misspelt entry).
 */
export function splitKnownFailures(files: string[], knownFailures: KnownFailure[], outDir: string): SplitPacts {
  mkdirSync(outDir, { recursive: true });
  const found = new Set<KnownFailure>();
  const verify: string[] = [];
  const expectedToFail: SplitPacts["expectedToFail"] = [];

  for (const file of files) {
    const pact = JSON.parse(readFileSync(file, "utf8")) as PactFile;
    const isKnown = (description: string) =>
      knownFailures.find((k) => k.consumer === pact.consumer.name && k.description === description);

    const kept = pact.interactions.filter((i) => !isKnown(i.description));
    if (kept.length > 0) {
      const copy = join(outDir, file.split("/").pop() as string);
      writeFileSync(copy, JSON.stringify({ ...pact, interactions: kept }, null, 2));
      verify.push(copy);
    }

    for (const interaction of pact.interactions) {
      const known = isKnown(interaction.description);
      if (!known) continue;
      found.add(known);
      const single = join(outDir, `${known.issue}-${expectedToFail.length}.json`);
      writeFileSync(single, JSON.stringify({ ...pact, interactions: [interaction] }, null, 2));
      expectedToFail.push({ failure: known, file: single });
    }
  }

  const stale = knownFailures.filter((k) => !found.has(k));
  if (stale.length > 0) {
    const list = stale.map((k) => `${k.issue} ${k.consumer}: "${k.description}"`).join("; ");
    throw new Error(`known failures that match no interaction (remove or fix them): ${list}`);
  }
  return { verify, expectedToFail };
}
