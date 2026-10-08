import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PactV3 } from "@pact-foundation/pact";
import { PACT_DIR, PACT_LOG_LEVEL } from "./pact.config.js";

/**
 * Absolute path of the repository's `pacts/` folder (AICHAT-11). Consumer tests run with
 * their own app as the working directory, so a relative `PACT_DIR` would scatter the files
 * across `apps/*`; resolving it from the workspace root gives CI one folder to upload and
 * the providers one folder to read. `PACT_DIR_OVERRIDE` points it elsewhere.
 */
export function pactDir(start: string = process.cwd()): string {
  const override = process.env["PACT_DIR_OVERRIDE"];
  if (override) return resolve(override);
  let dir = resolve(start);
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`no pnpm-workspace.yaml above ${start}`);
    dir = parent;
  }
  return join(dir, PACT_DIR);
}

/**
 * A `PactV3` for one consumer/provider pair that writes `<consumer>-<provider>.json` into
 * `pactDir()`. Names are used as given: the shell and auth-service are consumers too, so
 * the `mfe-` prefix of `consumerName()` does not apply to every pair.
 */
export function newConsumerPact(consumer: string, provider: string): PactV3 {
  // PactV3 has no "fatal" level (a V2 name still allowed by PACT_LOG_LEVEL).
  const logLevel = PACT_LOG_LEVEL === "fatal" ? "error" : PACT_LOG_LEVEL;
  return new PactV3({ consumer, provider, dir: pactDir(), logLevel });
}

/**
 * Deletes the pact files `consumer` wrote in an earlier run. Pact merges new interactions
 * into an existing file, so without this an interaction removed from a test would stay in
 * the contract. Called once at the start of a consumer's pact run.
 */
export function removePacts(consumer: string, dir: string = pactDir()): void {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    if (file.startsWith(`${consumer}-`) && file.endsWith(".json")) rmSync(join(dir, file));
  }
}

export interface RouteFetchOptions {
  /** Path prefix the shell's proxy removes before the provider sees the request (`/api`). */
  stripPrefix?: string;
  /** The fetch that really sends the request; defaults to the global one. */
  fetchImpl?: typeof fetch;
}

/**
 * Returns a `fetch` that sends the client's relative URLs (`/auth/me`, `/api/chats`) to
 * the Pact mock server, the way the browser resolves them against the page origin and the
 * shell's proxy forwards them. Consumer tests install it with `vi.stubGlobal("fetch", …)`
 * so the real API client code runs unchanged.
 */
export function routeFetchTo(baseUrl: string, options: RouteFetchOptions = {}): typeof fetch {
  const send = options.fetchImpl ?? globalThis.fetch;
  const { stripPrefix } = options;
  return (input, init) => {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, "http://consumer.invalid");
    let path = url.pathname;
    if (stripPrefix && (path === stripPrefix || path.startsWith(`${stripPrefix}/`))) {
      path = path.slice(stripPrefix.length) || "/";
    }
    return send(new URL(`${path}${url.search}`, baseUrl), init);
  };
}

/**
 * Runs `test` against the Pact mock server of `pact`: while it runs, the global `fetch` is
 * the one from `routeFetchTo`, so the client code under test talks to the mock server
 * without being changed. The previous `fetch` is restored afterwards, even on failure.
 *
 * `test` may reject on purpose (a client throwing on a 401 is the behaviour under test).
 * Pact only writes the interaction when its callback resolves, so the outcome is captured
 * inside and replayed after Pact has checked the requests: the returned promise settles
 * like `test` did. If the requests did not match what was declared, it rejects with Pact's
 * mismatch error instead and no pact is written.
 */
export async function runWithMockServer<T>(
  pact: PactV3,
  test: () => Promise<T>,
  options: Omit<RouteFetchOptions, "fetchImpl"> = {},
): Promise<T> {
  const outcome = await pact.executeTest(async (server) => {
    const original = globalThis.fetch;
    globalThis.fetch = routeFetchTo(server.url, { ...options, fetchImpl: original });
    try {
      return { ok: true as const, value: await test() };
    } catch (error) {
      return { ok: false as const, error };
    } finally {
      globalThis.fetch = original;
    }
  });
  // executeTest is typed `T | undefined`; it rejects instead of resolving without a value.
  if (!outcome) throw new Error("Pact mock server returned no outcome");
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
