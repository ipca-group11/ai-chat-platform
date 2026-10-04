import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { MockConfig } from "../config.js";
import type { ScenarioDefinition } from "../registry.js";
import { Pacer } from "./pacer.js";
import type { LlmProvider } from "./scenarios.js";

export const REPLAY_PREFIX = "replay:";
/** Where the AICHAT-25 recordings live, relative to the repo root. */
const REPO_FIXTURES = "services/conversation-service/src/test-utils/fixtures/llm";
const FIXTURE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The folder with `<provider>/<fixture>.sse`: FIXTURES_DIR, else the fixtures found from the repo root. */
export function fixturesDir(config: Pick<MockConfig, "fixturesDir">, from: string = process.cwd()): string {
  if (config.fixturesDir) return resolve(config.fixturesDir);
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return join(dir, REPO_FIXTURES);
    if (dirname(dir) === dir) return resolve(from, REPO_FIXTURES);
  }
}

export const isReplay = (scenario: string): boolean => scenario.startsWith(REPLAY_PREFIX);

export type FixtureLookup =
  | { found: true; bytes: Buffer }
  | { found: false; name: string; available: string[] };

/** Reads `<dir>/<provider>/<name>.sse`; when missing, says which fixtures exist. */
export async function readFixture(
  config: Pick<MockConfig, "fixturesDir">,
  provider: LlmProvider,
  scenario: string,
): Promise<FixtureLookup> {
  const name = scenario.slice(REPLAY_PREFIX.length).replace(/\.sse$/, "");
  const folder = join(fixturesDir(config), provider);
  if (FIXTURE_NAME.test(name) && !name.includes("..")) {
    try {
      return { found: true, bytes: await readFile(join(folder, `${name}.sse`)) };
    } catch {
      // falls through to the "not found" answer
    }
  }
  return { found: false, name, available: await listFixtures(folder) };
}

async function listFixtures(folder: string): Promise<string[]> {
  try {
    return (await readdir(folder)).filter((f) => f.endsWith(".sse")).map((f) => f.slice(0, -".sse".length)).sort();
  } catch {
    return [];
  }
}

/**
 * The recording cut into its SSE frames (each ends with a blank line), paced like a live
 * stream. Joined back, the frames are exactly the bytes of the file.
 */
export async function* replayFrames(
  bytes: Buffer,
  config: Pick<MockConfig, "ttftMs" | "tokenIntervalMs">,
  signal?: AbortSignal,
): AsyncGenerator<Buffer, void> {
  const pacer = new Pacer(config);
  // latin1 maps every byte to one character, so the round trip below keeps the bytes unchanged.
  for (const frame of bytes.toString("latin1").split(/(?<=\n\n)/)) {
    if (signal?.aborted) return;
    await pacer.next();
    yield Buffer.from(frame, "latin1");
  }
}

export function replayDefinition(provider: LlmProvider): ScenarioDefinition {
  return {
    mock: provider,
    name: `${REPLAY_PREFIX}<fixture>`,
    description: `Serves the recorded stream <FIXTURES_DIR>/${provider}/<fixture>.sse byte for byte`,
  };
}
