import exec from "k6/execution";
import { sleep } from "k6";
import { browseOnce, listChats, streamOnce } from "./lib/api.ts";
import { buildOptions, levelAt } from "./lib/scenarios.ts";

/**
 * Load test of the chat platform (AICHAT-24): one script, four scenarios picked with SCENARIO.
 *
 *   smoke         1 user, one full flow: register, sign in, create a chat, send a message, read the stream
 *   users_ramp    browsing users climb level by level (list chats and messages), finds the REST limit
 *   streams_ramp  new streams per second climb level by level, finds the concurrent-stream limit
 *   soak          a steady stream rate for SOAK_DURATION (default 30m), shows leaks and drift
 *
 * See testing/k6/README.md for the variables and docs/AICHAT-24/RESULTS.md for the numbers.
 */

const { settings, options } = buildOptions(__ENV);
export { options };

const tags = () => ({ level: levelAt(settings, exec.instance.currentTestRunDuration) });

export function smoke(): void {
  const t = tags();
  streamOnce(t);
  listChats(t);
}

export function browse(): void {
  browseOnce(tags());
  sleep(1 + Math.random() * 2);
}

export function stream(): void {
  const t = tags();
  streamOnce(t);
  listChats(t);
}
