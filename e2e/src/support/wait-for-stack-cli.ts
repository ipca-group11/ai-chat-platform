#!/usr/bin/env node
/**
 * Small CLI wrapper around `waitForStack` so CI (and local scripts) can run
 * `pnpm --filter e2e run wait-for-stack` before starting the Playwright
 * suite, instead of racing a slow-starting `docker compose up`.
 */
import { defaultStackTargets, waitForStack } from "./wait-for-stack.js";

const timeoutMs = Number(process.env["E2E_WAIT_TIMEOUT_MS"] ?? 180_000);

waitForStack(defaultStackTargets(), { timeoutMs }).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
