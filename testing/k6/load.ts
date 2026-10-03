import exec from "k6/execution";
import { sleep } from "k6";
import { browseOnce, listChats, register, signInPool, streamOnce } from "./lib/api.ts";
import { buildOptions, levelAt } from "./lib/scenarios.ts";

/**
 * Load test of the chat platform (AICHAT-24): one script, five scenarios picked with SCENARIO.
 *
 *   seed          registers SEED_USERS accounts once
 *   smoke         1 user, one full flow: register, sign in, create a chat, send a message, read the stream
 *   users_ramp    browsing users climb level by level (list chats and messages), finds the REST limit
 *   streams_ramp  new streams per second climb level by level, finds the concurrent-stream limit
 *   soak          a steady stream rate for SOAK_DURATION (default 30m), shows leaks and drift
 *
 * See testing/k6/README.md for the variables and docs/AICHAT-24/RESULTS.md for the numbers.
 */

const { settings, options } = buildOptions(__ENV);
export { options };

// Time since this scenario started (not the test: setup signs the accounts in first).
const tags = () => ({ level: levelAt(settings, Date.now() - exec.scenario.startTime) });

/** Signs the accounts in once; the virtual users share them (see lib/api.ts). */
export function setup(): string[] {
  return settings.scenario === "seed" ? [] : signInPool(settings.scenario === "smoke" ? 1 : undefined);
}

/** Registers account number 1, 2, 3 ... so that a later run only has to sign in. */
export function seed(): void {
  register(exec.scenario.iterationInTest + 1);
}

export function smoke(pool: string[]): void {
  const t = tags();
  streamOnce(pool, t);
  listChats(pool, t);
}

export function browse(pool: string[]): void {
  browseOnce(pool, tags());
  sleep(1 + Math.random() * 2);
}

export function stream(pool: string[]): void {
  const t = tags();
  streamOnce(pool, t);
  listChats(pool, t);
}
